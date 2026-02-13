self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("fetch", event => {
  // НЕ кэшируем API
  if (event.request.url.includes("/register") ||
      event.request.url.includes("/login") ||
      event.request.url.includes("/threads") ||
      event.request.url.includes("/me")) {
    return;
  }
});


