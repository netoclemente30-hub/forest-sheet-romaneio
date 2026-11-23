# Offline cold-start check for the installed PWA (generated /sw.js).
# Usage: build, copy dist/sw.js + dist/workbox-*.js into dist/client, serve with
#   bunx wrangler@4 dev -c dist/server/wrangler.json --port 4173 --ip 127.0.0.1
# then: APP=http://127.0.0.1:4173 python3 pwa_offline_cold_start.py online
# STOP the server (set_offline alone does not cut Service Worker network), then:
#   APP=... python3 pwa_offline_cold_start.py offline / /toras /romaneio /serraria /saldo /etiquetas
# Every route must render the app (or offline.html), never the generic error screen.
import asyncio, json, os, sys, shutil
from playwright.async_api import async_playwright
APP=os.environ.get("APP","http://127.0.0.1:4173")
PROF=os.environ.get("PROF","/tmp/browser/pwa/profile"); OUT="/tmp/browser/pwa"
PHASE=sys.argv[1]
async def main():
  async with async_playwright() as p:
    if PHASE=="online": shutil.rmtree(PROF, ignore_errors=True)
    ctx=await p.chromium.launch_persistent_context(PROF, headless=True, offline=(PHASE=="offline"), args=([] if PHASE=="online" else [os.environ.get("RULES","--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost")]))
    page=ctx.pages[0] if ctx.pages else await ctx.new_page()
    logs=[]
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"PAGEERROR {e}"))
    page.on("requestfailed", lambda r: logs.append(f"FAILED {r.url}"))
    if PHASE=="online":
      s=json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
      await page.goto(APP+"/", wait_until="domcontentloaded")
      await page.evaluate("([k,v])=>localStorage.setItem(k,v)", [s["storage_key"], json.dumps(s["session"])])
      if os.environ.get("EMP"): await page.evaluate("([k,v])=>localStorage.setItem(k,v)", ["empresa-selecionada:"+s["session"]["user"]["id"], os.environ["EMP"]])
      await page.reload(); await page.wait_for_timeout(4000)
      for r in ["/toras","/romaneio","/serraria","/saldo","/base","/historico","/relatorios","/"]:
        await page.goto(APP+r); await page.wait_for_timeout(3000)
      await page.wait_for_timeout(int(os.environ.get("WAIT","8000")))
      print("controller", await page.evaluate("!!navigator.serviceWorker.controller"))
      print("caches", await page.evaluate("caches.keys().then(async ks=>Promise.all(ks.map(async k=>k+':'+(await (await caches.open(k)).keys()).length)))"))
      print("paginas", await page.evaluate("caches.open('paginas').then(c=>c.keys()).then(r=>r.map(x=>x.url))"))
    else:
      if os.environ.get("EXPIRE"):
        await ctx.add_init_script("""if(location.origin===%r){for(const k of Object.keys(localStorage)){if(k.endsWith('-auth-token')){try{const v=JSON.parse(localStorage.getItem(k));v.expires_at=Math.floor(Date.now()/1000)-3600;localStorage.setItem(k,JSON.stringify(v))}catch(e){}}}}""" % APP)
      for r in sys.argv[2:]:
        try: await page.goto(APP+r, wait_until="load", timeout=20000)
        except Exception as e: logs.append(f"GOTO {r} {e}")
        await page.wait_for_timeout(int(os.environ.get("WAIT","8000")))
        n=r.strip("/").replace("/","_") or "root"
        await page.screenshot(path=f"{OUT}/off_{n}.png")
        print(r, "=>", (await page.inner_text("body"))[:200].replace("\n"," | ")); print("entry", await page.evaluate("[...document.scripts].map(s=>s.src).filter(Boolean)"))
    print("\n".join(logs[-40:]))
    await ctx.close()
asyncio.run(main())
