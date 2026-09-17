"""Version 2 regression flows in real Chrome, including branching and war phases."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'test-artifacts'
ARTIFACTS.mkdir(exist_ok=True)
URL = (ROOT / 'index.html').as_uri()
SAVE = 'on-the-brink.save.v2'
ROUTES = json.loads((ROOT / 'tests/ending-routes.json').read_text(encoding='utf-8'))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)

    def new_game(side):
        page.evaluate('localStorage.clear()')
        page.reload()
        page.locator(f'[data-action="start"][data-side="{side}"]').click()

    def decision(i):
        page.locator(f'[data-action="choose"][data-choice="{i}"]').click()
        assert page.locator('#result-panel').count() == 1
        page.locator('[data-action="next"]').click()

    def install(save):
        page.evaluate('(args) => localStorage.setItem(args.key, JSON.stringify(args.save))', {'key': SAVE, 'save': save})
        page.reload()
        page.locator('[data-action="resume"]').click()

    def state_value(expression):
        return page.evaluate("() => {const s=ColdWarEngine.restore(localStorage.getItem('on-the-brink.save.v2')); return " + expression + ';}')

    page.screenshot(path=str(ARTIFACTS / 'v2-desktop-home.png'), full_page=True)
    assert page.locator('h1').inner_text() == 'НА\nГРАНИ.'
    new_game('usa')
    assert page.locator('.exposition h3').inner_text() == 'Как мы здесь оказались'
    assert page.locator('.exposition li').count() == 3
    assert page.locator('.choice-why').count() == 3
    assert page.locator('.sidebar [role=meter]').count() == 8
    page.locator('[data-action="historical-hints"]').click()
    assert page.locator('.history-hint').count() == 1
    page.keyboard.press('1')
    page.keyboard.press('1')
    assert state_value('s.history.length') == 1
    page.reload()
    page.locator('[data-action="resume"]').click()
    assert page.locator('#result-panel').count() == 1
    page.locator('[data-action="next"]').click()
    page.locator('#archive-button').click()
    assert page.locator('dialog details').count() == 30  # 7 glossary + 19 events + 4 essays
    assert 'Что говорят источники' in page.locator('#modal-content').text_content()
    page.keyboard.press('2')
    assert state_value('s.history.length') == 1
    page.keyboard.press('Escape')
    page.locator('#guide-button').click()
    page.locator('#close-modal').click()

    # Both complete historical campaigns through visible buttons, not engine shortcuts.
    for side in ['usa', 'ussr']:
        new_game(side)
        for _ in range(19):
            assert page.locator('.exposition').count() == 1
            idx = state_value('ColdWarEngine.current(s).choices[s.side].findIndex(c => c.historical)')
            if state_value('s.index') == 4:
                page.screenshot(path=str(ARTIFACTS / f'v2-budget-{side}.png'), full_page=True)
            if state_value('s.index') == 17 and side == 'ussr':
                assert page.locator('[data-choice="1"]').is_disabled()
                assert page.locator('.lock-reason').is_visible()
            decision(idx)
        assert state_value('s.ending') == f'historical_{side}'
        assert page.locator('.journal-row').count() == 19
        with page.expect_download() as event:
            page.locator('[data-action="export"]').click()
        event.value.save_as(str(ARTIFACTS / f'v2-journal-{side}.txt'))
        text = (ARTIFACTS / f'v2-journal-{side}.txt').read_text(encoding='utf-8-sig')
        assert '1991' in text and 'Почему важно:' in text and 'https://' in text
        assert '\\r\\n' not in text and len(text.splitlines()) > 100

    # Concrete earlier choices replace the Berlin scene; save/load retains the branch.
    new_game('usa')
    decision(1)
    decision(1)
    assert page.locator('.stage h2').inner_text() == 'Берлин без блокады'
    assert '1945' in page.locator('.branch-card').inner_text()
    assert 'воздушный мост' not in page.locator('.choice-list').inner_text()
    page.reload()
    page.locator('[data-action="resume"]').click()
    assert page.locator('.stage h2').inner_text() == 'Берлин без блокады'
    page.screenshot(path=str(ARTIFACTS / 'v2-berlin-branch.png'), full_page=True)

    # Full Soviet victory through UI verifies domestic choices and final union scene.
    new_game('ussr')
    route = {'potsdam':0,'marshall':0,'airlift':0,'korea':0,'budget1953':1,'hungary':1,'space':0,'wall':0,'cuba':0,'vietnam':1,'economy1965':1,'prague':0,'salt':0,'afghan':0,'reform1985':0,'inf':0,'fall':0,'settlement1990':1,'end':0}
    for _ in range(19):
        current_id = state_value('ColdWarEngine.current(s).id')
        if current_id == 'end':
            assert page.locator('.stage h2').inner_text() == 'Союз, о котором договорились'
        decision(route[current_id])
    assert state_value('s.ending') == 'soviet_victory'
    assert 'СССР: выигранное соперничество' in page.locator('.ending h1').inner_text()
    page.screenshot(path=str(ARTIFACTS / 'v2-soviet-ending.png'), full_page=True)
    with page.expect_download() as event:
        page.locator('[data-action="export"]').click()
    event.value.save_as(str(ARTIFACTS / 'v2-branch-journal.txt'))
    assert 'Союз, о котором договорились' in (ARTIFACTS / 'v2-branch-journal.txt').read_text(encoding='utf-8-sig')

    # All alternative endings render from validated save files.
    for ending, save in ROUTES.items():
        install(save)
        assert page.locator('.ending').count() == 1
        assert state_value('s.ending') == ending

    # Save and load at the war decision, war result, then final screen.
    save = json.loads(json.dumps(ROUTES['war_victory']))
    save['decisions'][-1].pop('warChoice')
    save['phase'] = 'war'
    install(save)
    assert page.locator('.comparison').count() == 1
    assert page.locator('[data-action="war-choice"]').count() == 3
    page.screenshot(path=str(ARTIFACTS / 'v2-war.png'), full_page=True)
    page.locator('[data-action="war-choice"][data-choice="1"]').click()
    assert state_value('s.phase') == 'war_result'
    page.reload()
    page.locator('[data-action="resume"]').click()
    assert page.locator('#result-panel').count() == 1
    page.locator('[data-action="next"]').click()
    assert state_value('s.ending') == 'war_victory'
    page.locator('[data-action="retry"]').click()
    assert state_value('s.phase') == 'decision'

    # Starting a new campaign asks before replacing the current one.
    page.locator('#home-link').click()
    page.locator('[data-action="start"][data-side="usa"]').click()
    page.locator('[data-action="close"]').click()
    assert page.locator('[data-action="resume"]').count() == 1
    page.locator('[data-action="start"][data-side="usa"]').click()
    page.locator('[data-action="confirm-start"]').click()
    assert state_value('s.history.length') == 0

    # Old save remains intact, rather than being silently replayed under new rules.
    page.evaluate("localStorage.clear();localStorage.setItem('on-the-brink.save.v1','legacy untouched')")
    page.reload()
    assert 'первой версии' in page.locator('#notice').inner_text()
    page.locator('[data-action="start"][data-side="usa"]').click()
    assert page.evaluate("localStorage.getItem('on-the-brink.save.v1')") == 'legacy untouched'
    page.evaluate('(key)=>localStorage.setItem(key,"broken")', SAVE)
    page.reload()
    assert page.locator('[data-action="resume"]').count() == 0

    # Phone layout and type sizes, plus a mobile branch and war screen.
    page.set_viewport_size({'width': 390, 'height': 844})
    new_game('ussr')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.choice-detail').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)') >= 14
    assert page.locator('.deltas').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)') >= 12
    page.screenshot(path=str(ARTIFACTS / 'v2-mobile.png'), full_page=True)
    decision(1)
    decision(1)
    assert page.locator('.branch-card').count() == 1
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    install(save)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width': 320, 'height': 720})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('[data-action="war-choice"][data-choice="2"]').click()
    page.locator('[data-action="next"]').click()
    assert state_value('s.ending') == 'nuclear'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors

    # Storage blocked by browser settings does not disable gameplay.
    isolated = browser.new_context()
    isolated.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})")
    blocked = isolated.new_page()
    blocked.goto(URL)
    blocked.locator('[data-action="start"][data-side="usa"]').click()
    blocked.locator('[data-choice="0"]').click()
    assert blocked.locator('#result-panel').count() == 1
    assert 'Без сохранения' in blocked.locator('.save-state').inner_text()
    isolated.close()
    browser.close()
print('PASS: historical campaigns, changed Berlin, Soviet victory, all 14 endings, war phases, export, save/reload, legacy preservation, keyboard, mobile 320/390, blocked storage; no browser errors.')
