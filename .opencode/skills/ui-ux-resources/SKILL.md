---
name: ui-ux-resources
description: Curated free UI/UX/frontend resource catalog for agents - inspiration, patterns, component libraries, icons, fonts, color, motion, accessibility, and asset sources with license cautions and selection guidance.
---

# UI/UX Frontend Resources (Free-first)

Use this skill when designing/building/reviewing UI. Pick resources by **job-to-be-done**, not popularity. **Inspiration is not copying**: extract patterns (hierarchy, spacing, type, color roles, flow, motion intent), then implement original UI. Always verify current license/plan before shipping assets.

## 1) Inspiration & product reference

| Need | Sources | Use for | Caution |
|---|---|---|---|
| Real product flows | [Mobbin](https://mobbin.com/), [Page Flows](https://pageflows.com/), [Refero](https://refero.design/), [UX Archive](https://uxarchive.com/), [SaaS Interface](https://saasinterface.com/) | Onboarding, checkout, settings, dashboards, UX conventions | Freemium/paid tiers common; reference only. |
| Visual web/landing direction | [Awwwards](https://www.awwwards.com/), [Godly](https://godly.website/), [SiteInspire](https://www.siteinspire.com/), [Lapa Ninja](https://www.lapa.ninja/), [Land-book](https://land-book.com/), [One Page Love](https://onepagelove.com/), [Minimal Gallery](https://minimal.gallery/), [Dark Mode Design](https://www.darkmodedesign.com/) | Layout, typography, hero/CTA, dark mode, visual tone | Do not clone branding/layouts. |
| UI patterns/components | [component.gallery](https://component.gallery/), [Collect UI](https://collectui.com/), [UI Garage](https://uigarage.net/), [Navbar Gallery](https://www.navbar.gallery/), [Footer Design](https://www.footer.design/), [Checklist Design](https://www.checklist.design/) | Specific pattern ideas and states | Validate a11y and real usability. |

## 2) Implementation libraries (code)

| Need | Sources | Use when | Caution |
|---|---|---|---|
| React + Tailwind, editable source | [shadcn/ui](https://ui.shadcn.com/), [ReUI](https://reui.io/) | Want control/customization in codebase | You own copied code; review upstream updates manually. |
| Accessible primitives | [Radix Primitives](https://www.radix-ui.com/primitives), [Base UI](https://base-ui.com/), [Headless UI](https://headlessui.com/), [React Aria](https://react-spectrum.adobe.com/react-aria/) | Need behavior/a11y, custom visual design | You still handle visual design, labels, contrast, composition. |
| Fast styled systems | [daisyUI](https://daisyui.com/), [Flowbite](https://flowbite.com/), [HeroUI](https://www.heroui.com/), [Mantine](https://mantine.dev/), [Chakra UI](https://chakra-ui.com/) | Need speed/consistent components | Check bundle size, Tailwind/React version, theming fit. |
| Charts/dashboards | [Tremor](https://tremor.so/), [Recharts](https://recharts.org/), [Nivo](https://nivo.rocks/) | Data-heavy UI | Verify maintenance, a11y, performance on large data. |

Before choosing: confirm framework/version, license, accessibility, bundle/runtime cost, and whether code is copy-paste vs dependency.

## 3) Icons, fonts, color, assets

| Type | Free-first sources | Use for | License/caution |
|---|---|---|---|
| Icons | [Lucide](https://lucide.dev/), [Heroicons](https://heroicons.com/), [Tabler Icons](https://tabler.io/icons), [Phosphor](https://phosphoricons.com/), [Material Symbols](https://fonts.google.com/icons), [Simple Icons](https://simpleicons.org/), [Iconify](https://iconify.design/) | UI icons; Simple Icons for brand logos | Check license per set (MIT/Apache/common). Brand logos = trademark rules. |
| Fonts | [Google Fonts](https://fonts.google.com/), [Fontshare](https://www.fontshare.com/), [Fontsource](https://fontsource.org/), [Open Foundry](https://open-foundry.com/) | Web typography, self-hosting via Fontsource | Prefer OFL/Apache/free-commercial; don't redistribute font files. |
| Color | [Realtime Colors](https://www.realtimecolors.com/), [UI Colors](https://uicolors.app/), [Coolors](https://coolors.co/), [Radix Colors](https://www.radix-ui.com/colors), [Happy Hues](https://www.happyhues.co/), [Tailwind Colors](https://tailwindcss.com/docs/colors) | Palette, semantic scales, role preview | Verify contrast (WCAG AA/AAA). Don't rely on color alone. |
| Illustrations | [unDraw](https://undraw.co/), [Storyset](https://storyset.com/), [Open Peeps](https://www.openpeeps.com/), [Humaaans](https://www.humaaans.com/) | Empty states, onboarding, marketing | Check attribution/redistribution terms per asset/set. |
| Photos | [Unsplash](https://unsplash.com/), [Pexels](https://www.pexels.com/), [Pixabay](https://pixabay.com/), [Openverse](https://openverse.org/) | Hero/background/content imagery | Check license/model/property restrictions; avoid implying endorsement. |

## 4) Motion, accessibility, and UX rules

| Need | Sources | Use for | Caution |
|---|---|---|---|
| Motion | [Motion](https://motion.dev/), [GSAP](https://gsap.com/), [easings.net](https://easings.net/), [cubic-bezier.com](https://cubic-bezier.com/) | Transitions, micro-interactions, scroll/state animation | Purposeful motion only; respect `prefers-reduced-motion`; avoid layout-thrashing. |
| Accessibility | [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/), [WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/), [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/), [A11y Project](https://www.a11yproject.com/) | Keyboard/focus/semantics/contrast patterns | Test in real browser; ARIA is not a substitute for semantic HTML. |
| UX principles | [Laws of UX](https://lawsofux.com/), [Nielsen Norman Group articles](https://www.nngroup.com/articles/), [GOV.UK Design System](https://design-system.service.gov.uk/) | Forms, errors, navigation, cognitive load | Apply pragmatically to product context. |

## 5) Agent selection workflow

1. **Brief** - audience, product type, brand tone, platform, a11y/perf constraints.
2. **Research** - pick 2-3 sources: one flow reference, one visual reference, one pattern/system reference. Use `websearch`/`webfetch`; for library docs use `context7`.
3. **Extract, don't copy** - capture hierarchy, spacing, type scale, color roles, component states, motion intent.
4. **Choose stack** - primitives for control, styled libs for speed, copy-paste for ownership. Confirm current docs/version.
5. **Implement** - project tokens, semantic HTML, responsive states, loading/empty/error/success/disabled.
6. **Verify** - Playwright/screenshots, keyboard/focus, contrast, reduced motion, console errors. Record licenses for assets used.

## Quick defaults

- **Landing/marketing**: Awwwards/Godly/Lapa Ninja + shadcn/Tailwind/Motion + Lucide + Fontshare/Google Fonts + Unsplash/unDraw.
- **SaaS app/dashboard**: Mobbin/SaaS Interface + shadcn/Radix or Mantine + Tabler/Lucide + UI Colors/Radix Colors.
- **Fast MVP**: daisyUI/Mantine/Flowbite + Lucide/Heroicons + Google Fonts + unDraw/Storyset.
- **A11y-critical UI**: Radix/Base/React Aria + WAI-ARIA APG + WebAIM + keyboard/focus testing.