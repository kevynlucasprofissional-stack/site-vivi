/* Editor de vídeos para Quill: links confiáveis e WebM convertido no navegador.
 * Nenhuma mídia é enviada ao Worker antes da conversão terminar.
 */
(function () {
  "use strict";
  const MAX_UPLOAD = 15 * 1024 * 1024;
  const MAX_SOURCE = 500 * 1024 * 1024;
  const MAX_DURATION = 180;

  function sourceFromLink(text) {
    let url;
    try { url = new URL(String(text).trim()); } catch { throw new Error("Informe uma URL completa do YouTube ou Vimeo."); }
    if (url.protocol !== "https:") throw new Error("O link precisa começar com https://");
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
      }
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { provider: "youtube", id };
    }
    if (host === "youtu.be") {
      id = url.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { provider: "youtube", id };
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      id = host === "player.vimeo.com" && parts[0] === "video" ? parts[1] : parts[0];
      if (/^[0-9]{1,12}$/.test(id || "")) return { provider: "vimeo", id };
    }
    throw new Error("Link não reconhecido. Utilize uma URL de vídeo do YouTube ou Vimeo.");
  }

  function validVideo(value) {
    return value?.provider === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(value.id) ||
      value?.provider === "vimeo" && /^[0-9]{1,12}$/.test(value.id) ||
      value?.provider === "upload" && /^\/media\/video\/[a-f0-9-]{36}\.webm$/.test(value.url);
  }

  function register(Quill) {
    const BlockEmbed = Quill.import("blots/block/embed");
    class RvVideo extends BlockEmbed {
      static blotName = "rvvideo";
      static tagName = "DIV";
      static className = "rv-video-embed";
      static create(source) {
        const node = super.create();
        node.setAttribute("contenteditable", "false");
        if (!validVideo(source)) return node;
        node.dataset.provider = source.provider;
        if (source.provider === "upload") {
          node.dataset.url = source.url;
          const video = document.createElement("video");
          video.controls = true;
          video.preload = "metadata";
          video.playsInline = true;
          video.src = source.url;
          node.appendChild(video);
        } else {
          node.dataset.id = source.id;
          const iframe = document.createElement("iframe");
          iframe.src = source.provider === "youtube"
            ? "https://www.youtube-nocookie.com/embed/" + source.id
            : "https://player.vimeo.com/video/" + source.id;
          iframe.title = "Vídeo incorporado";
          iframe.loading = "lazy";
          iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
          iframe.allowFullscreen = true;
          iframe.referrerPolicy = "strict-origin-when-cross-origin";
          node.appendChild(iframe);
        }
        return node;
      }
      static value(node) {
        const provider = node.dataset.provider;
        const value = provider === "upload"
          ? { provider, url: node.dataset.url }
          : { provider, id: node.dataset.id };
        return validVideo(value) ? value : null;
      }
    }
    Quill.register(RvVideo, true);
  }

  async function convertToWebM(file, onProgress) {
    if (!file || file.size < 100 || file.size > MAX_SOURCE) {
      throw new Error("O arquivo de origem deve ter até 500 MiB.");
    }
    const mime = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"]
      .find(type => window.MediaRecorder?.isTypeSupported(type));
    if (!mime || !HTMLMediaElement.prototype.captureStream) {
      throw new Error("Este navegador não consegue converter vídeos. Utilize Chrome ou Edge atualizado no computador.");
    }
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = src; video.preload = "auto"; video.muted = true; video.playsInline = true;
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    let recorder, stream, timer, progressTimer;
    try {
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error("O navegador não conseguiu decodificar esse formato de vídeo."));
        video.load();
      });
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION) {
        throw new Error("Para upload gratuito, o vídeo precisa ter duração de até 3 minutos.");
      }
      stream = video.captureStream();
      let blobs = [], byteCount = 0, error = null;
      const conversion = new Promise((resolve, reject) => {
        recorder = new MediaRecorder(stream, { mimeType: mime,
          videoBitsPerSecond: 500000, audioBitsPerSecond: 64000 });
        recorder.ondataavailable = event => {
          if (event.data?.size) {
            byteCount += event.data.size;
            if (byteCount > MAX_UPLOAD) {
              error = new Error("Vídeo convertido excedeu 15 MiB. Reduza a duração ou hospede no YouTube.");
              recorder.stop();
            } else blobs.push(event.data);
          }
        };
        recorder.onerror = () => { error = new Error("Falha na conversão do vídeo."); };
        recorder.onstop = () => {
          if (error) { reject(error); return; }
          const converted = new File(blobs, "noticia.webm", { type: "video/webm" });
          if (converted.size < 100 || converted.size > MAX_UPLOAD)
            reject(new Error("O vídeo convertido não possui tamanho válido (limite 15 MiB)."));
          else resolve(converted);
        };
      });
      recorder.start(2000);
      video.onended = () => { if (recorder?.state === "recording") recorder.stop(); };
      onProgress(0);
      progressTimer = setInterval(() => {
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
      }, 1000);
      timer = setTimeout(() => {
        if (recorder?.state === "recording") {
          error = new Error("A conversão demorou demais e foi cancelada.");
          recorder.stop();
        }
      }, duration * 1000 + 25000);
      await video.play();
      const result = await conversion;
      onProgress(100);
      return result;
    } finally {
      clearTimeout(timer); clearInterval(progressTimer);
      if (recorder?.state === "recording") recorder.stop();
      if (stream) for (const t of stream.getTracks()) t.stop();
      video.pause(); video.removeAttribute("src"); video.load(); video.remove();
      URL.revokeObjectURL(src);
    }
  }

  let busy = false;
  function isBusy() { return busy; }
  function insert(quill, value) {
    if (!quill || !validVideo(value)) throw new Error("Vídeo inválido.");
    const position = quill.getSelection(true)?.index ?? Math.max(0, quill.getLength() - 1);
    quill.insertEmbed(position, "rvvideo", value, "user");
    quill.setSelection(position + 1, 0, "silent");
  }
  function bind(quillGetter, uploadFn, onStatus) {
    const link = document.getElementById("video-link");
    const linkButton = document.getElementById("insert-video-link");
    const file = document.getElementById("video-file");
    const fileButton = document.getElementById("insert-video-file");
    linkButton.onclick = () => {
      try {
        insert(quillGetter(), sourceFromLink(link.value));
        link.value = "";
        onStatus("Vídeo incorporado pelo link.");
      } catch (e) { onStatus(e.message, true); }
    };
    fileButton.onclick = async () => {
      if (busy) return;
      if (!file.files?.length) { onStatus("Selecione um vídeo primeiro.", true); return; }
      busy = true; fileButton.disabled = true;
      try {
        const result = await convertToWebM(file.files[0], percentage =>
          onStatus("Convertendo no navegador: " + percentage + "%. Aguarde a conclusão."));
        onStatus("Conversão concluída. Enviando WebM (" + (result.size / 1048576).toFixed(1) + " MiB)...");
        const url = await uploadFn(result);
        insert(quillGetter(), { provider: "upload", url });
        onStatus("Vídeo convertido, enviado e inserido com sucesso.");
        file.value = "";
      } catch (e) { onStatus(e.message || "Falha ao converter o vídeo.", true); }
      finally { busy = false; fileButton.disabled = false; }
    };
  }
  window.RvVideo = { register, bind, isBusy, sourceFromLink, validVideo };
})();
