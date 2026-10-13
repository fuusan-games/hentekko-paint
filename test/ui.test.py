import sys, json
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:18793/index.html?turbo&seed=7'
S='/workspace/hentekko-paint/test/shots/'
errs=[]
def drag(page, sel, a, b):
    box=page.locator(sel).bounding_box()
    f=lambda p:(box['x']+box['width']*p[0]/100, box['y']+box['height']*p[1]/100)
    page.mouse.move(*f(a)); page.mouse.down(); page.mouse.move(*f(((a[0]+b[0])/2,(a[1]+b[1])/2))); page.mouse.move(*f(b)); page.mouse.up()
def G(page): return page.evaluate('JSON.parse(JSON.stringify(HP_DEBUG.G))')
def run(page, humans_mode=False, correct_every=2):
    shots=set(); turns=0; checked=False
    for step in range(400):
        page.wait_for_timeout(120)
        g=G(page)
        if g['phase']=='end': break
        if page.locator('#diceOv').count(): continue
        if page.locator('#bGate').count():
            if 'gate' not in shots: page.screenshot(path=S+'gate.png'); shots.add('gate')
            page.click('#bGate'); continue
        if page.locator('#pad').count():
            drag(page,'#pad',(20,20),(80,20)); drag(page,'#pad',(50,55),(50,80)); 
            n=page.inner_text('#cnt')
            assert n=='2', n
            # snapping: start near the endpoint (21,21) should snap onto (20,20)
            drag(page,'#pad',(21,21.5),(20,80))
            if not checked:
                g2=page.evaluate('Object.values(window.__pads||{})')
            page.click('#tC'); drag(page,'#pad',(50,50),(50,35)); page.click('#tL')
            assert page.inner_text('#cnt')=='4'
            page.click('#tU'); assert page.inner_text('#cnt')=='3'
            if 'draw' not in shots: page.screenshot(path=S+'draw.png'); shots.add('draw')
            page.click('#bDone'); continue
        if page.locator('#bRoll').count(): page.click('#bRoll'); continue
        if page.locator('#gIn').count():
            if 'reveal' not in shots: page.wait_for_timeout(400); page.screenshot(path=S+'reveal.png'); shots.add('reveal')
            turns+=1
            ans = g['_w'] if '_w' in g else page.evaluate('HP_DEBUG.W[HP_DEBUG.G.target].w')
            page.fill('#gIn', ans if turns%correct_every==0 else 'はずれ')
            page.click('#gGo'); continue
        if page.locator('#bNext').count():
            g=G(page)
            # verify reveal order rule
            n=len(g['players']); a=g['ans']
            order=g['order']; cnts=[len(g['drawings'][i]) for i in order]
            assert cnts==sorted(cnts), cnts
            for i in range(len(order)-1):
                if cnts[i]==cnts[i+1]: assert (order[i]-a)%n < (order[i+1]-a)%n
            if 'end' not in shots: page.screenshot(path=S+'roundend.png'); shots.add('end')
            page.click('#bNext'); continue
    g=G(page); assert g['phase']=='end', g['phase']
    page.screenshot(path=S+('final_h.png' if humans_mode else 'final.png'))
    return g
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=False)
    page=ctx.new_page(); page.on('pageerror',lambda e:errs.append(str(e))); page.on('console',lambda m: m.type=='error' and errs.append(m.text))
    page.goto(URL); page.wait_for_timeout(800); page.screenshot(path=S+'title.png')
    page.click('#goLocal'); page.screenshot(path=S+'setup.png'); page.click('#startLocal')
    g=run(page)
    print('CPU game end scores', [(x['name'],x['score']) for x in g['players']], 'rounds', g['round'])
    # pass-and-play: 3 humans
    page.goto(URL); page.evaluate("localStorage.setItem('hp_seats',JSON.stringify([{h:1,name:'A'},{h:1,name:'B'},{h:1,name:'C'}]))"); page.reload(); page.wait_for_timeout(300)
    page.click('#goLocal'); page.click('#startLocal')
    g=run(page,True,1)
    print('3 humans scores', [(x['name'],x['score']) for x in g['players']])
    # all correct on first => each round answerer+3, first drawer +2
    assert sum(x['score'] for x in g['players'])==3*5
    b.close()
print('errors',errs)
