# UI spacing controls

## Browser tab icon

Current default: `frontend/public/favicon.svg`, linked in `frontend/index.html`. To use your image, place a square 512x512 PNG (transparent background recommended) at `frontend/public/favicon.png` and change the favicon link to `<link rel="icon" type="image/png" href="/favicon.png" />`. A 32x32 PNG also works for tab-only artwork; 512x512 is a convenient source resolution. ICO is optional for legacy compatibility; if using it, include 16/32/48px sizes in `frontend/public/favicon.ico` and set `type="image/x-icon"`/`href="/favicon.ico"`. Public files use root URLs, not `/public/` URLs. Browser icon caching may require a hard refresh or reopening the tab.

Edit the blocks labeled `Layout knobs` in `frontend/src/styles/planner.css` and `Home navbar knobs` in `frontend/src/styles/landing.css`. Values at the end of these files override older responsive rules.

Planner variables (on `.planner-app`):

```css
--planner-page-gutter: 12px;       /* Mobile panel and bottom dock left/right space */
--planner-nav-height: 48px;       /* Top navbar height; keep room for 44px buttons */
--planner-nav-padding-inline: 16px; /* Top navbar inner left/right padding */
--planner-nav-margin-block: 0px;  /* Space outside navbar, above and below */
```

Home variables (on `.landing`):

```css
--home-nav-height: 76px;
--home-nav-inline: clamp(16px, 3.5vw, 48px);
```

The home header is fixed; the landing page reserves matching top space automatically. Its horizontal padding also centers content within a 1264px inner width on large screens. Edit `.landing .site-header` for background transparency/blur. Mobile menu positioning follows navbar height automatically. Section anchor offsets keep headings visible below the fixed header.

Short landscape planner layouts (desktop/tablet width >=768px, height <=550px) have a dedicated media block after the planner variables. Its welcome card scrolls from the top rather than centering content beyond the viewport. Mobile dock styles follow this block; inactive views use native disabled buttons until backend route/checkpoint data exists. Adjust spacing here rather than adding more conflicting overrides earlier in the files.
