import { G } from './state.js';
import { clearInput, lockPointer, unlockPointer } from './input.js';
import { discoveredRecords } from './archive-model.mjs';
import * as story from './story.js';
const $ = id => document.getElementById(id);
const root=$('archive'), list=$('archiveList'), count=$('archiveCount');
let entries=[], selected=0;
const areaNames={porto:'Cais',ruinas:'Ruínas',lab:'Laboratório',pantano:'Pântano',patio:'Pátio',heliponto:'Heliponto',margem:'Margem',acampamento:'Acampamento',ninho:'Ninho'};
function render() {
  list.replaceChildren(); count.textContent=`${entries.length} de ${story.TOTAL_LOGS} registros encontrados`;
  if (!entries.length) { const p=document.createElement('p'); p.textContent='Nenhum registro encontrado ainda. Explore o vale para preencher o arquivo.'; list.appendChild(p); return; }
  entries.forEach((entry,index)=> {
    const button=document.createElement('button'); button.type='button'; button.className='archive-entry'+(index===selected?' on':'');
    button.setAttribute('aria-pressed', String(index===selected));
    const title=document.createElement('strong'); title.textContent=entry.title;
    const detail=document.createElement('span'); detail.textContent=`${areaNames[entry.area] || entry.area} · ${entry.who}`;
    button.append(title,detail); button.addEventListener('click',()=>{ selected=index; readSelected(); });
    list.appendChild(button);
  });
}
function readSelected() {
  const item=entries[selected]; if (item && G.state==='archive') story.showCard(story.logPages(item.id));
}
export function openArchive() {
  if(G.state!=='play' || G.transitioning) return false;
  entries=discoveredRecords(story.LOG_IDS,story.LOGS,story.S.logs); selected=0;
  G.state='archive'; clearInput(); unlockPointer(); render(); root.classList.remove('hidden');
  return true;
}
export function closeArchive() {
  if(G.state!=='archive') return false;
  root.classList.add('hidden'); G.state='play'; clearInput(); lockPointer(); return true;
}
export function archiveKey(code) {
  if(G.state!=='archive') return;
  if(code==='Escape' || code==='KeyJ') return closeArchive();
  if(code==='ArrowDown' || code==='ArrowUp') {
    if(!entries.length) return;
    selected=(selected+(code==='ArrowDown'?1:-1)+entries.length)%entries.length; render();
    list.children[selected]?.scrollIntoView({block:'nearest'}); return;
  }
  if(code==='Enter' || code==='KeyE' || code==='Space') readSelected();
}
$('archiveClose').addEventListener('click',closeArchive);
