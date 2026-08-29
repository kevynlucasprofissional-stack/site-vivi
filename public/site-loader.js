(function () {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const response = await nativeFetch(input, init);
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    if (url.includes('/site-base.html')) {
      const html = await response.text();
      const injected = html.replace(
        '</body>',
        '<script src="/processo-addon.js?v=20260829"></' + 'script>\n</body>'
      );
      return new Response(injected, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    return response;
  };

  const script = document.createElement('script');
  script.src = '/site-patch.js?v=20260829';
  script.onerror = function () {
    document.body.innerHTML = '<main style="max-width:720px;margin:60px auto;padding:20px;font:16px system-ui"><h1>Não foi possível carregar a página.</h1><p>Tente atualizar.</p></main>';
  };
  document.head.appendChild(script);
})();
