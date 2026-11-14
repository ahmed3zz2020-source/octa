"""لقطة الأذرع (المحاور السبعة) في كارت القرار — محور «أخبار» برقمه الحقيقي.

الاستخدام: python3 tools/shot-news-arms.py [code]
"""
import os, sys, json, time, urllib.request
from playwright.sync_api import sync_playwright
CODE = sys.argv[1] if len(sys.argv) > 1 else "ETEL"
URL="https://octa-preview.ahmed3zz2020.workers.dev"
API="https://octa-prices-production-4ccb.up.railway.app"
CHROME="/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
OUT="/workspace/output"
req=urllib.request.Request(API+"/api/admin/mint_session",
  data=json.dumps({"email":"ahmed3zz2020@gmail.com","ttl":1800}).encode(),
  headers={"X-OCTA-Admin":os.environ.get("OCTA_ADMIN_TOKEN",""),"Content-Type":"application/json"},method="POST")
TOKEN=json.loads(urllib.request.urlopen(req,timeout=30).read().decode())["token"]
with sync_playwright() as p:
    br=p.chromium.launch(args=["--no-sandbox","--disable-dev-shm-usage"],executable_path=CHROME)
    ctx=br.new_context(viewport={"width":390,"height":900}, device_scale_factor=2)
    dom=URL.split("//",1)[1].split("/",1)[0]
    ctx.add_cookies([{"name":"octa_token","value":TOKEN,"domain":dom,"path":"/"}])
    ctx.add_init_script("try{localStorage.setItem('octa_token',%s)}catch(e){}"%json.dumps(TOKEN))
    pg=ctx.new_page()
    pg.goto(URL+"/index.html",wait_until="domcontentloaded",timeout=60000)
    time.sleep(8)
    pg.evaluate("(c)=>{try{openCard(c,null,'egx')}catch(e){}}",CODE)
    time.sleep(16)
    # الأذرع: .marm
    box = pg.evaluate("""()=>{
        var rows=document.querySelectorAll('#mBody .marm');
        var first=null,last=null;
        for (var i=0;i<rows.length;i++){
            var r=rows[i].getBoundingClientRect();
            if (r.height<5) continue;
            if (!first) first=r;
            last=r;
        }
        if (!first) return null;
        var l=document.getElementById('mlay');
        l.scrollTop += (first.top - 120);
        return true;
    }""")
    time.sleep(1.2)
    box = pg.evaluate("""()=>{
        var rows=document.querySelectorAll('#mBody .marm');
        var out=[];
        for (var i=0;i<rows.length;i++){
            var r=rows[i].getBoundingClientRect();
            if (r.height<5) continue;
            out.push([r.x,r.y,r.width,r.height,(rows[i].innerText||'').replace(/\\n/g,' ')]);
        }
        if (!out.length) return null;
        var top=out[0][1], bot=out[out.length-1][1]+out[out.length-1][3];
        return {x:out[0][0], y:top, w:out[0][2], h:bot-top, rows:out.map(o=>o[4])};
    }""")
    print(json.dumps(box,ensure_ascii=False,indent=1)[:900])
    if box:
        shot=OUT+"/news-axis-arms-%s-390.png"%CODE
        pg.screenshot(path=shot, clip={"x":max(0,box["x"]-6),"y":max(0,box["y"]-10),
                                       "width":min(box["w"]+12,390),"height":min(box["h"]+20,900-max(0,box["y"]-10))})
        print("📸",shot)
