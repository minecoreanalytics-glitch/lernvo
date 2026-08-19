import json, os
D = json.load(open('word.json'))
AMBER, DARK, NAVY, WHITE = '#F5B700', '#0E1116', '#163A6B', '#FFFFFF'

HANDLE = 'M25 11h14a5 5 0 0 1 5 5v4h-5.5v-2.5a1.5 1.5 0 0 0-1.5-1.5h-10a1.5 1.5 0 0 0-1.5 1.5V20H20v-4a5 5 0 0 1 5-5z'
BODY   = '<rect x="5" y="20" width="54" height="33" rx="5"/>'
SEAM   = 'M5 35H16M35 35H59'
CLASP  = 'M17.5 35l5 5 16-12.5'          # clasp-check inside the seam gap
BIGCHK = 'M18 36.5l7.5 7.5L47 28'        # simplified small-size / icon variant

def mark(color, mid, mid_w, mask_id):
    """Briefcase with knocked-out closure line — true transparency via mask."""
    return (f'<defs><mask id="{mask_id}"><rect width="64" height="64" fill="#000"/>'
            f'<g fill="#fff"><path d="{HANDLE}"/>{BODY}</g>'
            f'<g fill="none" stroke="#000" stroke-width="{mid_w}" stroke-linecap="butt" stroke-linejoin="miter">'
            f'<path d="{mid}"/></g></mask></defs>'
            f'<rect width="64" height="64" fill="{color}" mask="url(#{mask_id})"/>')

def svg(inner, w=64, h=64, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="Lernvo"{extra}>{inner}</svg>\n')

os.makedirs('out', exist_ok=True)
FULL = lambda c, i: mark(c, f'{SEAM} {CLASP}', 5, i)
SMALL = lambda c, i: mark(c, BIGCHK, 6.4, i)

open('out/mark-navy.svg','w').write(svg(FULL(NAVY,'a')))
open('out/mark-amber.svg','w').write(svg(FULL(AMBER,'a')))
open('out/mark-white.svg','w').write(svg(FULL(WHITE,'a')))

# chip = dark squircle + amber mark (works on light UI and at small sizes)
chip = (f'<rect width="64" height="64" rx="14" fill="{DARK}"/>'
        f'<g transform="translate(8.48 8.48) scale(0.735)">{SMALL(AMBER,"c")}</g>')
open('out/mark-chip.svg','w').write(svg(chip))
open('out/favicon.svg','w').write(svg(chip))

# maskable icon: more padding inside the safe zone
maskable = (f'<rect width="64" height="64" fill="{DARK}"/>'
            f'<g transform="translate(12.8 12.8) scale(0.6)">{SMALL(AMBER,"m")}</g>')
open('out/maskable.svg','w').write(svg(maskable))

def lockup(bg, markc, wordc, tagc, name, chip_bg=None):
    s = 64            # mark box
    ms = 56           # rendered mark size
    wsize = 46        # wordmark size
    ww = D['w1']/100*wsize
    gap = 16
    total_w = ms + gap + ww
    pad = 18
    W, H = round(total_w + pad*2), 96
    x0 = pad
    inner = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else ''
    if chip_bg:
        inner += f'<rect x="{x0}" y="{(H-ms)/2}" width="{ms}" height="{ms}" rx="12" fill="{chip_bg}"/>'
        inner += f'<g transform="translate({x0+ms*0.135} {(H-ms)/2+ms*0.135}) scale({ms/s*0.73})">{SMALL(markc,"lk"+name)}</g>'
    else:
        inner += f'<g transform="translate({x0} {(H-ms)/2}) scale({ms/s})">{FULL(markc,"lk"+name)}</g>'
    baseline = H/2 + 0.75*wsize/2
    inner += f'<g transform="translate({x0+ms+gap} {baseline})" fill="{wordc}"><path d="{D["word"]}" transform="scale({wsize/100})"/></g>'
    return svg(inner, W, H)

open('out/lockup-light.svg','w').write(lockup(None, AMBER, '#101720', None, 'l', chip_bg=DARK))
open('out/lockup-dark.svg','w').write(lockup(DARK, AMBER, WHITE, None, 'd'))
open('out/lockup-navy.svg','w').write(lockup(None, NAVY, NAVY, None, 'n'))

# OG image 1200x630
ms, msize = 150, 150
wsize, tsize = 120, 20
ww = D['w1']/100*wsize; tw = D['w2']/100*tsize
og = (f'<rect width="1200" height="630" fill="{DARK}"/>'
      f'<g transform="translate({(1200-msize)/2} 150) scale({msize/64})">{FULL(AMBER,"og")}</g>'
      f'<g transform="translate({(1200-ww)/2} 420)" fill="{WHITE}"><path d="{D["word"]}" transform="scale({wsize/100})"/></g>'
      f'<g transform="translate({(1200-tw)/2} 480)" fill="#8D99A8"><path d="{D["tag"]}" transform="scale({tsize/100})"/></g>')
open('out/og-image.svg','w').write(svg(og, 1200, 630))
print('\n'.join(f'{f}  {os.path.getsize("out/"+f)}b' for f in sorted(os.listdir('out'))))
