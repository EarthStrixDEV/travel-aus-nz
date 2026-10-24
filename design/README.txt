TravelAusNZ — design source files (Design canvas export)

canvas.json      Canvas layout: every artboard's position, size and title.
pages/*.dc.html  One file per artboard (Design Component format).

Main pages (contain the real content and logic):
  Main, HomeMobile, Map, MapMobile, Gallery, Transport, Dining, Trip,
  System (design system), Currency, Dishes, Visa, Prepare

Variant wrappers (import a main page with a different state):
  *Dark, *Mobile, *MobileDark, CurrencyLoading/Error,
  DishDetail*, DishFiltersMobile, VisaMobileLoading/Result

Note: .dc.html files need the canvas runtime (support.js) to render.
Open them in the Design canvas, or use them as a reference for development.
Design tokens: navy #13213A, off-white #F6F2EA, copper #9E5229
(dark: #0E1729 / #F3EEE4 / #D08A5E). Font: Prompt (Google Fonts).
All prices, rates, fees and visa mappings are placeholders to verify.
