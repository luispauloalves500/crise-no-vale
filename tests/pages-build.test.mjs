import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

test('artefato Pages inclui Jill, Lima, armas, grama e sombra, decodifica Marina e exclui fontes originais',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  const block=workflow.match(/- name: Montar o site\n\s+run: \|\n([\s\S]*?)(?=\n\s+- name:)/)?.[1];assert.ok(block);
  const lines=block.split('\n'),indent=Math.min(...lines.filter(l=>l.trim()).map(l=>l.match(/^ */)[0].length));
  const script=lines.map(l=>l.slice(indent)).join('\n'),root=mkdtempSync(join(tmpdir(),'crise-pages-test-'));
  try{
    const paths=['index.html','css/style.css','js/main.js','assets/personagens/jill.glb','assets/personagens/dra-lima-lod.glb','assets/armas/glock-lod.glb','assets/armas/mp5-lod.glb','assets/shadow.webp','assets/models/grass-patch.glb','js/grass.js','js/grass-policy.mjs','assets/originais/Jill Valentine.glb'];
    for(const f of paths){mkdirSync(dirname(join(root,f)),{recursive:true});writeFileSync(join(root,f),'fixture');}
    writeFileSync(join(root,'assets/marina.min.glb.b64'),Buffer.from('glTF').toString('base64'));
    execFileSync('bash',['-e','-c',script],{cwd:root});
    for(const f of paths.filter(p=>!p.includes('/originais/')))assert.ok(existsSync(join(root,'_site',f)),f);
    assert.equal(readFileSync(join(root,'_site/assets/marina.min.glb'),'utf8'),'glTF');
    assert.equal(existsSync(join(root,'_site/assets/originais')),false);assert.ok(existsSync(join(root,'_site/.nojekyll')));
  }finally{rmSync(root,{recursive:true,force:true});}
});
