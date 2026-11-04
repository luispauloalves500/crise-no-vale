# assets/originais — arquivos-fonte (não carregados pelo jogo)

Estes ~54 MB são os GLB de origem, sem otimização. **Nenhum arquivo em `js/`, `index.html` ou `tests/` aponta para esta pasta.** O jogo carrega as versões otimizadas:

| Original aqui | Versão usada pelo jogo |
|---|---|
| `Dra Lima.glb` (16 MB) | `assets/personagens/dra-lima-lod.glb` (a `dra-lima.glb` completa serve de referência para o teste de LOD) |
| `MP5.glb` (22 MB) | `assets/armas/mp5-lod.glb` |
| `escopeta.glb` (1,3 MB) | modelo procedural / LOD em `assets/armas/` |
| `Jill Valentine.glb` (16 MB) | personagem desbloqueável já existente (não expandido no v11) |

O GitHub Pages publica a pasta, mas o navegador só baixa o que o código pede, então ela não pesa no carregamento. Ela pesa no clone. Se quiser enxugar o repositório, **mova** a pasta para fora do repo (ou para um release/LFS) em vez de apagar. Os testes não dependem dela.

Atenção: `Jill Valentine.glb` tem nome e aparência de personagem de outra franquia. Para um projeto 100% original, vale trocar ou renomear esse modelo antes de qualquer divulgação.
