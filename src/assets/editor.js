/* =============================================================
   A small rich text editor.

   contenteditable plus a fixed toolbar, in about the space a
   dependency's loader would take. The commands are the ones the
   server's allowlist accepts, so the editor cannot produce markup
   that gets stripped on submit.

   execCommand is deprecated and has no replacement with comparable
   support. For a toolbar this size it remains the honest choice.
   ============================================================= */

const COMMANDS = [
  { key: 'bold', label: 'B', title: 'Bold', style: 'font-weight:700' },
  { key: 'italic', label: 'I', title: 'Italic', style: 'font-style:italic' },
  { key: 'h2', label: 'H2', title: 'Heading' },
  { key: 'h3', label: 'H3', title: 'Subheading' },
  { key: 'ul', label: '• List', title: 'Bulleted list' },
  { key: 'ol', label: '1. List', title: 'Numbered list' },
  { key: 'quote', label: '❝', title: 'Quote' },
  { key: 'link', label: 'Link', title: 'Add a link' },
  { key: 'image', label: 'Image', title: 'Insert an image' },
];

const RUN = {
  bold: () => document.execCommand('bold'),
  italic: () => document.execCommand('italic'),
  h2: () => block('H2'),
  h3: () => block('H3'),
  ul: () => document.execCommand('insertUnorderedList'),
  ol: () => document.execCommand('insertOrderedList'),
  quote: () => block('BLOCKQUOTE'),
};

/** Toggle a block format, so pressing H2 inside an H2 returns to a paragraph. */
function block(tag) {
  const current = document.queryCommandValue('formatBlock').toUpperCase();
  document.execCommand('formatBlock', false, current === tag ? 'P' : tag);
}

/**
 * @param {HTMLElement} host      where the editor is built
 * @param {object}      options
 * @param {function}    options.upload  (File) => Promise<{url}>, for images
 * @param {function}    options.onChange called with the current markup
 */
export function createEditor(host, { upload, onChange } = {}) {
  const bar = document.createElement('div');
  bar.className = 'ed-bar';

  const surface = document.createElement('div');
  surface.className = 'ed-surface';
  surface.contentEditable = 'true';
  surface.spellcheck = true;
  surface.setAttribute('role', 'textbox');
  surface.setAttribute('aria-multiline', 'true');
  surface.setAttribute('aria-label', 'The concept');
  surface.innerHTML = '<p><br></p>';

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.hidden = true;

  const changed = () => onChange?.(surface.innerHTML);

  for (const command of COMMANDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ed-btn';
    button.title = command.title;
    button.textContent = command.label;
    if (command.style) button.setAttribute('style', command.style);

    /* mousedown, not click: the selection is still there before focus moves. */
    button.addEventListener('mousedown', event => {
      event.preventDefault();
      surface.focus();

      if (command.key === 'link') return addLink();
      if (command.key === 'image') return file.click();

      RUN[command.key]?.();
      changed();
    });
    bar.append(button);
  }

  function addLink() {
    const selected = String(document.getSelection() ?? '');
    if (!selected) return note('Select the words to link first.');
    const url = window.prompt('Link to:', 'https://');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return note('Links have to start with http:// or https://');
    document.execCommand('createLink', false, url);
    changed();
  }

  const message = document.createElement('p');
  message.className = 'ed-note';
  const note = text => { message.textContent = text ?? ''; };

  async function insertImage(chosen) {
    if (!chosen) return;
    if (!upload) return note('Sign in before adding images.');
    note(`Uploading ${chosen.name}…`);
    try {
      const { url } = await upload(chosen);
      surface.focus();
      /* A figure, so a caption has somewhere to live. */
      document.execCommand('insertHTML', false,
        `<figure><img src="${url}" alt=""><figcaption>Add a caption</figcaption></figure><p><br></p>`);
      note('');
      changed();
    } catch (error) {
      note(`Upload failed — ${error?.message || error}`);
    }
  }

  file.addEventListener('change', () => {
    insertImage(file.files[0]);
    file.value = '';
  });

  /* Pasting from a word processor brings a mountain of markup with it. Taking
     the plain text is the predictable thing; the toolbar puts formatting
     back deliberately. */
  surface.addEventListener('paste', event => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    changed();
  });

  surface.addEventListener('drop', event => {
    const dropped = [...(event.dataTransfer?.files ?? [])].find(f => f.type.startsWith('image/'));
    if (!dropped) return;
    event.preventDefault();
    insertImage(dropped);
  });

  surface.addEventListener('input', changed);

  host.append(bar, surface, message, file);

  return {
    get html() { return surface.innerHTML; },
    set html(value) { surface.innerHTML = value || '<p><br></p>'; changed(); },
    get text() { return surface.textContent.trim(); },
    focus: () => surface.focus(),
  };
}
