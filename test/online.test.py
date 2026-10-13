from playwright.sync_api import sync_playwright
U='http://127.0.0.1:18793/index.html?turbo'
errs=[]
def drag(page,a,b):
    box=page.locator('#pad').bounding_box();f=lambda p:(box['x']+box['width']*p[0]/100,box['y']+box['height']*p[1]/100)
    page.mouse.move(*f(a));page.mouse.down();page.mouse.move(*f(b));page.mouse.up()
with sync_playwright() as p:
    b=p.chromium.launch()
    H=b.new_context(viewport={'width':390,'height':844}).new_page();C=b.new_context(viewport={'width':390,'height':844}).new_page()
    for pg,n in((H,'H'),(C,'C')):pg.on('pageerror',lambda e,n=n:errs.append(n+str(e)))
    H.goto(U);H.click('#goOnline');H.fill('#onName','ホスト');H.click('#mkRoom');H.wait_for_selector('#lobCode:not(:empty)',timeout=20000)
    code=H.inner_text('#lobCode');print('room',code)
    C.goto(U);C.click('#goOnline');C.fill('#onName','ゲスト');C.fill('#onCode',code);C.click('#joinRoom')
    H.wait_for_function("document.getElementById('lobList').innerText.includes('ゲスト')",timeout=20000)
    H.click('#lobCpu');H.click('#lobStart')
    leaks=0
    for step in range(600):
        H.wait_for_timeout(120)
        g=H.evaluate('JSON.parse(JSON.stringify(HP_DEBUG.G))')
        if g['phase']=='end':break
        for pg,seat in((H,0),(C,1)):
            if pg.locator('#diceOv').count():continue
            # secrecy: the answerer device must not show the word
            if g['ans']==seat and g['phase'] in('draw','reveal') and g['target'] is not None:
                w=H.evaluate('HP_DEBUG.W[HP_DEBUG.G.target].w')
                if w in pg.inner_text('#gameBody'):leaks+=1
            if pg.locator('#bRoll').count():pg.click('#bRoll')
            elif pg.locator('#pad').count():drag(pg,(10,50),(90,50));pg.click('#tC');drag(pg,(50,50),(50,30));pg.click('#tL');pg.click('#bDone')
            elif pg.locator('#gIn').count():
                pg.fill('#gIn',H.evaluate('HP_DEBUG.W[HP_DEBUG.G.target].w') if g['revealed']>=2 or len(g['order'])==1 else 'ちがう');pg.click('#gGo')
            elif pg.locator('#bNext').count():pg.click('#bNext')
    g=H.evaluate('JSON.parse(JSON.stringify(HP_DEBUG.G))');print('phase',g['phase'],[(x['name'],x['score']) for x in g['players']],'leaks',leaks)
    C.wait_for_timeout(500);print('client sees end:', '結果発表' in C.inner_text('#gameBody'))
    C.screenshot(path='test/shots/online_client_end.png');b.close()
print('errors',errs)
