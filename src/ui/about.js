import { t } from './locale.js';

export function initAbout() {
  const opener = document.querySelector('[data-about]');
  if (!opener) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'about';
  dialog.className = 'about-dialog';
  dialog.setAttribute('aria-labelledby', 'about-title');
  dialog.innerHTML = `
    <div class="about-header">
      <h2 id="about-title" tabindex="-1" autofocus></h2>
      <form method="dialog"><button class="about-close" type="submit"></button></form>
    </div>
    <div class="about-copy"></div>`;

  const copy = dialog.querySelector('.about-copy');
  const paragraphs = ['aboutIntroduction', 'aboutAuthor', 'aboutScience', 'aboutIdea',
    'aboutWorld', 'aboutAmateur', 'aboutAI'];
  function translate() {
    dialog.querySelector('h2').textContent = t('aboutTitle');
    dialog.querySelector('button').textContent = t('aboutClose');
    copy.replaceChildren(...paragraphs.map((key) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = t(key);
      return paragraph;
    }));
    const contact = document.createElement('p');
    const [before, after] = t('aboutContact', { github: '\n' }).split('\n');
    const profile = document.createElement('a');
    profile.href = 'https://github.com/robertchaba';
    profile.textContent = t('aboutGithub');
    contact.append(before, profile, after);
    copy.append(contact);
  }

  translate();
  document.body.append(dialog);
  document.addEventListener('emergence:localechange', translate);
  opener.addEventListener('click', (event) => {
    event.preventDefault();
    dialog.showModal();
    copy.scrollTop = 0;
  });
  opener.hidden = false;
}
