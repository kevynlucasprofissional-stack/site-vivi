/* Editor visual de imagens, inspirado no fluxo ClassicPress: selecionar,
   dimensionar e alinhar no próprio corpo da matéria, preservando Quill Delta. */
(function () {
  "use strict";
  const SIZES = ["25%", "50%", "75%", "100%"];
  const ALIGNS = ["left", "center", "right"];
  const IMG_PATH = /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/;

  function register(Quill) {
    const Image = Quill.import("formats/image");
    class EditorialImage extends Image {
      static formats(node) {
        const formats = super.formats(node);
        const align = node.getAttribute("data-img-align");
        if (ALIGNS.includes(align)) formats.imgAlign = align;
        return formats;
      }
      format(name, value) {
        if (name === "imgAlign") {
          if (ALIGNS.includes(value)) this.domNode.setAttribute("data-img-align", value);
          else this.domNode.removeAttribute("data-img-align");
          return;
        }
        if (name === "width") {
          if (SIZES.includes(value)) this.domNode.setAttribute("width", value);
          else this.domNode.removeAttribute("width");
          return;
        }
        super.format(name, value);
      }
    }
    Quill.register(EditorialImage, true);
  }

  function bind(quill, notify) {
    const tools = document.getElementById("rv-image-tools");
    const info = document.getElementById("rv-image-selected");
    if (!tools) throw new Error("Ferramentas de imagem ausentes.");
    let selected = null;
    const editor = quill.root;

    function imageAtSelection() {
      const range = quill.getSelection();
      if (!range) return null;
      const [leaf] = quill.getLeaf(range.index);
      const node = leaf?.domNode;
      return node?.tagName === "IMG" && IMG_PATH.test(node.getAttribute("src") || "") ? node : null;
    }
    function refresh(node = imageAtSelection()) {
      if (node && editor.contains(node) && IMG_PATH.test(node.getAttribute("src") || "")) {
        selected?.classList.remove("rv-image-selected");
        selected = node;
        selected.classList.add("rv-image-selected");
        tools.classList.remove("rv-hidden");
        const width = node.getAttribute("width") || "100%";
        const align = node.getAttribute("data-img-align") || "left";
        info.textContent = "Imagem selecionada · " + width + " · " +
          ({ left: "esquerda", center: "centralizada", right: "direita" }[align] || "esquerda");
        tools.querySelectorAll("button[data-img-size]").forEach(btn => {
          btn.setAttribute("aria-pressed", String(btn.dataset.imgSize === width));
        });
        tools.querySelectorAll("button[data-img-align]").forEach(btn => {
          btn.setAttribute("aria-pressed", String(btn.dataset.imgAlign === align));
        });
      } else {
        selected?.classList.remove("rv-image-selected");
        selected = null;
        tools.classList.add("rv-hidden");
      }
    }
    function apply(format, value) {
      if (!selected || !editor.contains(selected)) { refresh(); return; }
      const blot = Quill.find(selected);
      if (!blot) { refresh(); return; }
      const index = quill.getIndex(blot);
      quill.formatText(index, 1, format, value, "user");
      const [next] = quill.getLeaf(index);
      refresh(next?.domNode?.tagName === "IMG" ? next.domNode : null);
      quill.focus();
      quill.setSelection(index, 1, "silent");
    }
    tools.addEventListener("mousedown", event => { if (event.target.closest("button")) event.preventDefault(); });
    tools.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.imgSize) apply("width", button.dataset.imgSize);
      else if (button.dataset.imgAlign) apply("imgAlign", button.dataset.imgAlign);
      else if (button.id === "rv-image-remove" && selected) {
        const blot = Quill.find(selected);
        const index = blot ? quill.getIndex(blot) : -1;
        if (index >= 0) quill.deleteText(index, 1, "user");
        refresh(null);
      }
    });
    editor.addEventListener("click", event => {
      const image = event.target.closest("img");
      if (image && editor.contains(image) && IMG_PATH.test(image.getAttribute("src") || "")) {
        const blot = Quill.find(image);
        if (blot) quill.setSelection(quill.getIndex(blot), 1, "silent");
        refresh(image);
      } else refresh();
    });
    quill.on("selection-change", (range) => {
      // Keep image controls visible while user operates contextual buttons.
      if (range && selected) {
        const image = imageAtSelection();
        if (image && image !== selected) refresh(image);
      }
    });
    quill.on("text-change", () => {
      if (selected && !editor.contains(selected)) refresh(null);
    });
    async function insert(upload, originalPosition) {
      try {
        notify("Enviando imagem...", false);
        const url = await upload();
        if (!IMG_PATH.test(url)) throw new Error("Servidor retornou uma imagem inválida.");
        const position = Math.min(Number.isInteger(originalPosition) ? originalPosition :
          (quill.getSelection(true)?.index ?? quill.getLength() - 1), Math.max(0, quill.getLength() - 1));
        quill.insertEmbed(position, "image", url, "user");
        quill.formatText(position, 1, { width: "75%", imgAlign: "center" }, "user");
        const insertedImage = Array.from(editor.querySelectorAll("img"))
          .reverse().find(img => img.getAttribute("src") === url);
        if (insertedImage) {
          const imageBlot = Quill.find(insertedImage);
          const index = imageBlot ? quill.getIndex(imageBlot) : position;
          quill.setSelection(index, 1, "silent");
          refresh(insertedImage);
        }
        notify("Imagem inserida. Selecione-a para ajustar tamanho e posição.", false);
      } catch (err) {
        notify(err?.message || "Não foi possível inserir a imagem.", true);
      }
    }
    return { insert, refresh };
  }
  window.RvImage = { register, bind, validPath: path => IMG_PATH.test(path) };
})();
