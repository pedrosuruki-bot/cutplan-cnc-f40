# CutPlan CNC — Auditoria final V4

## Alterações desta versão
- Planeamento Altendorf F40 por faixas: rasgos horizontais para separar faixas e cortes verticais limitados à faixa.
- Importação CSV robusta para `;`, `,` e TAB, cabeçalhos em português/inglês, unidades mm/cm/m/polegadas e números europeus/internacionais.
- Stock de sobras persistente no projeto e opção para o otimizador tentar usar sobras antes de chapas compradas.
- Proteções no leitor de fotografias: tipos MIME permitidos, limite de payload, limite de peças, intervalo mínimo entre pedidos e validação dos valores devolvidos.
- PDF operacional: lista de corte em A4 paisagem, checkbox `[ ]`, material, fita, notas, páginas de operações com cabeçalho repetido e páginas de etiquetas.
- Backup `.cutplan.json` mantém stock de sobras e parâmetros.
- Testes de regressão adicionados para stock de sobras e limites dos cortes de esquadro F40.

## Verificações
- `tsc` global confirmou que os ficheiros alterados não apresentam erros de parsing/sintaxe quando verificados isoladamente com `--noResolve`.
- Teste de execução do módulo F40 via TypeScript/ts-node: 12 peças colocadas, 0 restantes, 15 operações e validação geométrica sem sobreposições.
- A compilação completa do projeto NÃO foi declarada como passada porque este ambiente não conseguiu instalar `node_modules` dentro do limite de tempo. O projeto continua com `bun.lock` para instalação normal no Lovable/Bun.

## Atenções de produção
1. A sequência F40 é um plano de produção assistido, não uma substituição das regras de segurança nem uma garantia de que todas as operações sejam adequadas à configuração física específica da máquina.
2. O stock de sobras é reutilizado pelo otimizador, mas a quantidade física deve ser atualizada pelo operador depois de consumir uma sobra.
3. A leitura de fotografia é assistida por IA e exige conferência humana antes de adicionar as medidas ao projeto.
4. O endpoint da fotografia tem rate limit em memória. Em produção com múltiplas instâncias, aplicar também rate limiting no fornecedor/plataforma.
