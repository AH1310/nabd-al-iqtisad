/* Service Worker — نبض الاقتصاد
   يخزّن ملفات التطبيق (App Shell) للفتح الفوري والعمل دون اتصال بالإنترنت.
   تُحفظ آخر قراءة أسعار ناجحة وتاريخها في localStorage وتُعرض تلقائيًا عند انقطاع الإنترنت،
   وفور عودة الاتصال يستأنف التطبيق التحديث المباشر من الخادم. */

const VERSION = "nabd-v2.0.0";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* لا نتدخل في طلبات API الخارجية (الووركر ومصادر الأسعار) */
  if (url.origin !== self.location.origin) return;

  /* طلبات التنقل (فتح التطبيق أو إعادة التحميل): الشبكة أولًا مع رجوع فوري للنسخة المحفوظة دون اتصال */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() =>
          caches.match("./index.html", { ignoreSearch: true })
            .then(cached => cached || caches.match("./", { ignoreSearch: true }))
        )
    );
    return;
  }

  /* الملفات الثابتة والأيقونات: من الكاش فورًا مع تحديث في الخلفية */
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
