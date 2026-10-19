#!/usr/bin/env python3
"""فحص بصري للشارتات في متصفح حقيقي (Playwright).
   python3 tools/visual-check.py [base_url] [outdir]
   بيختبر: فلتر الأسهم · كارت الذهب · صفحة الشارت · تبويب المحرك.
"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/tvshots"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"


async def shot(pg, name):
    p = os.path.join(OUT, name + ".png")
    await pg.screenshot(path=p)
    return p


async def frames(pg, label):
    out = []
    for fr in pg.frames:
        u = fr.url.lower()
        if "tradingview" not in u:
            continue
        import urllib.parse as _up
        _q = _up.parse_qs(_up.urlparse(fr.url).query)
        info = {"label": label, "host": fr.url.split("/")[2] if "//" in fr.url else "?",
                "sym": (_q.get("symbol") or ["-"])[0], "url": fr.url[:90]}
        try:
            info["canvases"] = await fr.evaluate("document.querySelectorAll('canvas').length")
            t = (await fr.evaluate("document.body?document.body.innerText:''")) or ""
            t = t.replace("\n", " ")
            info["painted"] = await fr.evaluate("""() => {
                const cs=[...document.querySelectorAll('canvas')]; let n=0;
                for(const c of cs){ if(!c.width||!c.height) continue;
                  try{ const g=c.getContext('2d');
                    const d=g.getImageData(0,0,Math.min(c.width,700),Math.min(c.height,320)).data;
                    let ink=0; for(let i=3;i<d.length;i+=4) if(d[i]>10) ink++;
                    if(ink>60) n++; }catch(e){} }
                return n; }""")
            # هل فيها أسعار حقيقية؟ ∅ معناها فاضي
            info["data"] = ("EMPTY" if "∅" in t[:400] and "EGX:" in t[:400] else "HAS-DATA") \
                if "EGX:" in t[:400] or "OANDA" in t[:400] or "XAU" in t[:400] else "n/a"
            info["text"] = t[:150]
        except Exception as e:
            info["err"] = str(e)[:110]
        out.append(info)
    return out


async def main():
    os.makedirs(OUT, exist_ok=True)
    res = {"base": BASE, "steps": {}}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME,
              args=["--no-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 1000},
                                  ignore_https_errors=True)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:180]))
        api_log = []
        pg.on("response", lambda r: api_log.append(f"{r.status} {r.url[:120]} {r.headers.get('content-type','')[:24]}")
              if ("/api/" in r.url and "127.0.0.1" in BASE) else None)

        # 🧪 محلي بس: خلي الـAPI على نفس الأصل (البروكسي بيمرّره) — CORS عند Railway مقصور على octashares.com
        if "127.0.0.1" in BASE or "localhost" in BASE:
            await ctx.add_init_script("()=>{try{window.OCTA_API='';}catch(e){}}")
        await pg.goto(BASE + "/", wait_until="domcontentloaded")
        await pg.evaluate("()=>{try{localStorage.setItem('octa_token','t');localStorage.setItem('octa_user','{}')}catch(e){}}")
        await pg.reload(wait_until="domcontentloaded")
        await pg.wait_for_timeout(5000)
        if "127.0.0.1" in BASE or "localhost" in BASE:
            await pg.evaluate("()=>{try{window.OCTA_API='';}catch(e){}}")
        res["steps"]["home"] = {"shots": await shot(pg, "01-home"),
                                "frames": await frames(pg, "home")}

        # ── 3) كارت الذهب ──
        if "127.0.0.1" in BASE or "localhost" in BASE:
            await pg.evaluate("()=>{try{window.OCTA_API='';}catch(e){}}")   # الـfailover بيعيد ضبطها
        await pg.evaluate("()=>{try{if(window.OCTA_API!==undefined)window.OCTA_API='';}catch(e){} try{if(window.openGoldIntel)window.openGoldIntel();else if(window.openGold)window.openGold();}catch(e){window.__e2=String(e)}}")
        await pg.wait_for_timeout(14000)
        res["steps"]["gold"] = {
            "shots": await shot(pg, "03-gold"),
            "frames": await frames(pg, "gold"),
            "err": await pg.evaluate("()=>window.__e2||''"),
            "goldHost": await pg.evaluate("""()=>{var w=document.getElementById('gmv')||document.querySelector('.gmodal');
              if(!w) return 'NO GOLD MODAL'; var h=w.querySelector('.gchart'); if(!h) return 'NO CHART HOST';
              var r=h.getBoundingClientRect(); var f=h.querySelector('iframe.octa-tv-frame');
              return 'host='+Math.round(r.width)+'x'+Math.round(r.height)+' iframe='+(f?(f.src||'').slice(0,60):'none');}"""),
        }

        # ── 1) فلتر الأسهم → مودال الشارت ──
        await pg.evaluate("()=>{try{window.openChart('COMI','البنك التجاري الدولي','EGX')}catch(e){window.__e1=String(e)}}")
        await pg.wait_for_timeout(12000)
        res["steps"]["filter_chart"] = {
            "shots": await shot(pg, "02-filter-chart"),
            "frames": await frames(pg, "filter"),
            "err": await pg.evaluate("()=>window.__e1||''"),
            "hostIframes": await pg.evaluate("()=>{var m=document.getElementById('octaChartModal');var h=m&&m.querySelector('.gchart');return h?h.querySelectorAll('iframe.octa-tv-frame').length:-1;}"),
        }

        # ── 2) ملء الشاشة على السهم + الخروج ──
        await pg.evaluate("()=>{var b=document.getElementById('ocm-fs');if(b)b.click();}")
        await pg.wait_for_timeout(6000)
        res["steps"]["filter_fullscreen"] = {
            "shots": await shot(pg, "02b-filter-fullscreen"),
            "frames": await frames(pg, "filter-fs"),
            "fsOn": await pg.evaluate("()=>!!document.querySelector('.octa-tv-fs')"),
            "exitBtn": await pg.evaluate("()=>{var b=document.querySelector('.octa-tv-fs-exit');return b?b.textContent.trim():'MISSING';}"),
        }
        await pg.evaluate("()=>{var b=document.querySelector('.octa-tv-fs-exit');if(b)b.click();}")
        await pg.wait_for_timeout(2500)
        res["steps"]["filter_fullscreen"]["afterExit"] = await pg.evaluate(
            "()=>({fsOff:!document.querySelector('.octa-tv-fs'),btnGone:!document.querySelector('.octa-tv-fs-exit'),"
            "unlocked:!document.body.classList.contains('octa-tv-fs-on'),modal:document.getElementById('octaChartModal').style.display})")
        await pg.evaluate("()=>{try{window.closeOctaChart()}catch(e){}}")
        await pg.wait_for_timeout(1500)

        # ── 3) كارت الذهب ──
        if "127.0.0.1" in BASE or "localhost" in BASE:
            await pg.evaluate("()=>{try{window.OCTA_API='';}catch(e){}}")   # الـfailover بيعيد ضبطها
        await pg.evaluate("()=>{try{if(window.OCTA_API!==undefined)window.OCTA_API='';}catch(e){} try{if(window.openGoldIntel)window.openGoldIntel();else if(window.openGold)window.openGold();}catch(e){window.__e2=String(e)}}")
        await pg.wait_for_timeout(14000)
        res["steps"]["gold"] = {
            "shots": await shot(pg, "03-gold"),
            "frames": await frames(pg, "gold"),
            "err": await pg.evaluate("()=>window.__e2||''"),
            "goldHost": await pg.evaluate("""()=>{var w=document.getElementById('gmv')||document.querySelector('.gmodal');
              if(!w) return 'NO GOLD MODAL'; var h=w.querySelector('.gchart'); if(!h) return 'NO CHART HOST';
              var r=h.getBoundingClientRect(); var f=h.querySelector('iframe.octa-tv-frame');
              return 'host='+Math.round(r.width)+'x'+Math.round(r.height)+' iframe='+(f?(f.src||'').slice(0,60):'none');}"""),
        }

        # ── 1) فلتر الأسهم → مودال الشارت ──
        await pg.evaluate("()=>{try{window.openChart('COMI','البنك التجاري الدولي','EGX')}catch(e){window.__e1=String(e)}}")
        await pg.wait_for_timeout(12000)
        res["steps"]["filter_chart"] = {
            "shots": await shot(pg, "02-filter-chart"),
            "frames": await frames(pg, "filter"),
            "err": await pg.evaluate("()=>window.__e1||''"),
            "hostIframes": await pg.evaluate("()=>{var m=document.getElementById('octaChartModal');var h=m&&m.querySelector('.gchart');return h?h.querySelectorAll('iframe.octa-tv-frame').length:-1;}"),
        }


        # ── 4) تبويب المحرك (الـwidgets اللي كانت بتطلع ∅) ──
        await pg.evaluate("()=>{try{window.closeGold&&window.closeGold();}catch(e){}}")
        await pg.evaluate("()=>{try{switchPage('engine')}catch(e){window.__e3=String(e)}}")
        await pg.wait_for_timeout(14000)
        res["steps"]["engine_tab"] = {
            "shots": await shot(pg, "04-engine"),
            "frames": await frames(pg, "engine"),
            "err": await pg.evaluate("()=>window.__e3||''"),
        }

        # ── 5) صفحة الشارت المستقلة ──
        pg2 = await ctx.new_page()
        await pg2.goto(BASE + "/assets/chart.html", wait_until="domcontentloaded")
        await pg2.wait_for_timeout(14000)
        res["steps"]["chart_page"] = {
            "shots": await shot(pg2, "05-chart-page"),
            "frames": await frames(pg2, "chartpage"),
        }
        await pg2.close()

        res["api_log"] = api_log[:25]
        res["errors"] = errs[:20]
        await b.close()
    print(json.dumps(res, ensure_ascii=False, indent=1))


asyncio.run(main())
