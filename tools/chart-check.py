#!/usr/bin/env python3
"""فحص شامل لشارت OCTA في متصفح موبايل حقيقي.
   python3 tools/chart-check.py [base_url]
   بيغطي: الترويسة · البحث · ملء الشاشة · الرسم · قفل التمرير · التصوير
"""
import asyncio, sys, os, re, json
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/octa-chart-check"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
SHOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".shots")


async def swipe(pg, x0, y0, x1, y1, steps=14):
    cdp = await pg.context.new_cdp_session(pg)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
    for i in range(1, steps + 1):
        await cdp.send("Input.dispatchTouchEvent",
                       {"type": "touchMove", "touchPoints": [{"x": x0 + (x1 - x0) * i / steps,
                                                            "y": y0 + (y1 - y0) * i / steps}]})
        await pg.wait_for_timeout(30)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await pg.wait_for_timeout(900)
    await cdp.detach()


async def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOT, exist_ok=True)
    r = {"base": BASE, "checks": {}}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME,
              args=["--no-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, ignore_https_errors=True)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        await pg.goto(BASE + "/", wait_until="domcontentloaded")
        await pg.evaluate("()=>{try{localStorage.setItem('octa_token','t');localStorage.setItem('octa_user','{}')}catch(e){}}")
        await pg.reload(wait_until="domcontentloaded")
        await pg.wait_for_timeout(5000)
        await pg.evaluate("()=>{var g=document.getElementById('gate');if(g)g.remove();}")

        # ① الترويسة
        await pg.evaluate("()=>{try{window.openChart('MPRC','المصرية لمدينة الإنتاج الاعلامي','EGX')}catch(e){}}")
        await pg.wait_for_timeout(13000)
        r["checks"]["head"] = await pg.evaluate("""()=>{
          const t=document.getElementById('ocm-title'), c=document.getElementById('ocm-code');
          const h=document.querySelector('.ocm-head');
          return {name:t?t.textContent.trim():'-', code:c?c.textContent:'-',
                  nameTruncated: t ? (t.scrollHeight > t.clientHeight+2) : true,
                  shot: !!document.querySelector('#ocm-shot .ocm-shot'),
                  search: !!document.querySelector('.octa-pick-in'),
                  buttons: [...h.querySelectorAll('button')].map(b=>(b.getAttribute('aria-label')||'').slice(0,22))};}""")
        await pg.screenshot(path=os.path.join(SHOT, "V1-head.png"))

        # ② البحث
        await pg.fill(".octa-pick-in", "مدينه")
        await pg.wait_for_timeout(700)
        r["checks"]["search"] = await pg.evaluate("""()=>{
          const dd=document.querySelector('.octa-pick-dd');
          const rows=[...document.querySelectorAll('.octa-pick-row')].map(x=>x.innerText.replace(/\\n/g,' '));
          return {visible: dd && !dd.hidden, onTop: dd ? getComputedStyle(dd).zIndex : '-', rows: rows.slice(0,3)};}""")
        await pg.screenshot(path=os.path.join(SHOT, "V2-search.png"))
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(10000)
        r["checks"]["afterSearch"] = await pg.evaluate("""()=>{const c=document.getElementById('ocm-code');
          return {code:c?c.textContent:'(لا يوجد)', modal: !!document.getElementById('octaChartModal'),
                  goldOpen: !!document.getElementById('gmv'),
                  pick:(document.querySelector('.octa-pick-in')||{}).value,
                  iframe:(document.querySelector('#octaChartModal iframe')||{}).src||''};}""")

        # ③ قفل التمرير
        await pg.evaluate("()=>window.scrollTo(0,600)")
        await pg.wait_for_timeout(400)
        box = await pg.evaluate("""()=>{var f=document.querySelector('#octaChartModal iframe.octa-tv-frame');
          if(!f) return null; var r=f.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};}""")
        y0 = await pg.evaluate("()=>window.scrollY")
        await swipe(pg, box["x"]+box["w"]/2, box["y"]+box["h"]/2, box["x"]+box["w"]/2, box["y"]+box["h"]/2-180)
        r["checks"]["pageLock"] = {"before": y0, "after": await pg.evaluate("()=>window.scrollY")}

        # ④ الرسم
        ta = await pg.evaluate("""()=>{var f=document.querySelector('#octaChartModal iframe.octa-tv-frame');
          var r=f.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};}""")
        await pg.mouse.click(ta["x"]+26, ta["y"]+112)
        await pg.wait_for_timeout(1200)
        clip = {"x": ta["x"], "y": ta["y"], "width": ta["w"], "height": ta["h"]}
        await pg.screenshot(path=os.path.join(OUT, "draw0.png"), clip=clip)
        await swipe(pg, ta["x"]+ta["w"]*0.35, ta["y"]+ta["h"]*0.45,
                    ta["x"]+ta["w"]*0.35+170, ta["y"]+ta["h"]*0.45+140, steps=14)
        await pg.screenshot(path=os.path.join(OUT, "draw1.png"), clip=clip)
        from PIL import Image, ImageChops
        A = Image.open(os.path.join(OUT, "draw0.png")).convert("RGB")
        B2 = Image.open(os.path.join(OUT, "draw1.png")).convert("RGB")
        r["checks"]["draw"] = {"drawn": bool(ImageChops.difference(A, B2).getbbox())}
        await pg.screenshot(path=os.path.join(SHOT, "V3-draw.png"))

        # ⑤ ملء الشاشة + الخروج
        await pg.evaluate("()=>{document.getElementById('ocm-fs').click()}")
        await pg.wait_for_timeout(4000)
        r["checks"]["fullscreen"] = await pg.evaluate("""()=>({on:!!document.querySelector('.octa-tv-fs'),
          exit:!!document.querySelector('.octa-tv-fs-exit'), locked:document.body.classList.contains('octa-tv-fs-on')})""")
        await pg.screenshot(path=os.path.join(SHOT, "V4-fs.png"))
        await pg.evaluate("()=>{var b=document.querySelector('.octa-tv-fs-exit');if(b)b.click()}")
        await pg.wait_for_timeout(2200)
        r["checks"]["afterExit"] = await pg.evaluate("""()=>{const m=document.getElementById('octaChartModal');
          return {off:!document.querySelector('.octa-tv-fs'),
          btnGone:!document.querySelector('.octa-tv-fs-exit'), unlocked:!document.body.classList.contains('octa-tv-fs-on'),
          modal:m?m.style.display:'NO MODAL'};}""")

        r["errors"] = errs[:8]
        await b.close()
    print(json.dumps(r, ensure_ascii=False, indent=1))


asyncio.run(main())