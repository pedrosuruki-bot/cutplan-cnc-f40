# CutPlan Pro

Quero que cries uma aplicação web completa de otimização de planos de corte para carpintaria, marcenaria e CNC, inspirada em ferramentas como CutList Optimizer, mas com interface moderna e preparada para evoluir para uso profissional.

OBJETIVO

Construir uma aplicação chamada provisoriamente CutPlan CNC, que permita ao utilizador:

Cadastrar chapas de material.

Inserir uma lista de peças com dimensões e quantidades.

Definir a espessura do corte/kerf.

Otimizar automaticamente a distribuição das peças nas chapas.

Permitir rotação das peças quando autorizada.

Mostrar visualmente o plano de corte.

Calcular aproveitamento e desperdício.

Mostrar sobras.

Mostrar a ordem sugerida dos cortes.

Exportar o resultado para PDF.

Preparar a arquitetura para futuras exportações DXF/SVG e integração com CNC.

A aplicação deve usar milímetros como unidade padrão.

TECNOLOGIA

Usa uma stack moderna e simples de manter.

Preferência:

Next.js

React

TypeScript

Tailwind CSS

componentes UI modernos

biblioteca de gráficos/canvas adequada para desenhar o plano de corte

algoritmo de otimização implementado de forma modular

armazenamento local inicialmente, sem necessidade de login

arquitetura preparada para posteriormente adicionar backend e base de dados

Antes de criar dependências desnecessárias, verifica o que já existe no projeto e reutiliza o que for adequado.

PRINCÍPIO MAIS IMPORTANTE

O projeto deve ser funcional, não apenas visual.

Não cries um mockup onde os botões parecem funcionar mas não fazem nada.

As funcionalidades principais devem estar implementadas e testáveis.

Especialmente:

cálculo de layout;

kerf;

rotação;

múltiplas peças;

múltiplas chapas;

cálculo de aproveitamento;

cálculo de desperdício;

identificação de peças que não cabem.

INTERFACE

Criar uma interface profissional, limpa e rápida.

Layout principal:

Barra superior

Nome:

CutPlan CNC

À direita:

Novo projeto

Guardar projeto

Exportar PDF

MENU PRINCIPAL

Criar navegação lateral com:

Projeto

Chapas

Peças

Otimização

Plano de corte

Relatório

ECRÃ "PROJETO"

Campos:

Nome do projeto

Cliente

Data

Observações

Mostrar resumo:

quantidade de chapas utilizadas;

número total de peças;

área total das peças;

área total das chapas;

aproveitamento;

desperdício.

ECRÃ "CHAPAS"

Permitir adicionar várias chapas.

Cada chapa deve possuir:

material;

comprimento;

largura;

espessura;

quantidade;

preço opcional;

nome/opcional.

Exemplo:

Material: MDF Branco
Comprimento: 2800
Largura: 2070
Espessura: 18
Quantidade: 10

Permitir editar e eliminar chapas.

ECRÃ "PEÇAS"

Criar uma tabela editável.

Colunas:

ID

Nome

Comprimento

Largura

Quantidade

Material

Rodar 90°

Sentido da madeira

Fita de bordo

Observações

Permitir:

adicionar linha;

eliminar linha;

duplicar linha;

editar diretamente na tabela;

importar CSV futuramente.

Exemplo:

P001 | Lateral | 700 | 450 | 2 | MDF Branco | Sim

CONFIGURAÇÕES DE CORTE

Criar uma secção chamada:

Parâmetros de corte

Campos:

Kerf / espessura do corte:
valor padrão = 3,2 mm

Margem mínima da chapa:
valor padrão = 10 mm

Distância mínima entre peças:
valor padrão = 3,2 mm

Permitir definir:

rotação de peças;

prioridade por aproveitamento;

prioridade por menor número de cortes.

Criar três modos:

Máximo aproveitamento

Priorizar menor desperdício.

Menos cortes

Tentar reduzir o número total de cortes.

Corte simples

Priorizar layouts mais fáceis de executar na oficina.

ALGORITMO DE OTIMIZAÇÃO

Esta é a parte mais importante da aplicação.

Criar um módulo independente:

/lib/optimizer

Não colocar toda a lógica dentro dos componentes React.

O algoritmo deve aceitar:

chapas;

peças;

quantidades;

kerf;

margens;

rotação permitida.

E retornar:

chapas utilizadas;

posição X/Y de cada peça;

largura/altura;

rotação;

sobra;

aproveitamento;

desperdício;

peças não colocadas.

Começar com um algoritmo robusto de 2D rectangle packing / bin packing adequado para peças retangulares.

Pode ser utilizado:

MaxRects

Guillotine packing

Skyline

ou combinação destes

A implementação deve ser modular para permitir melhorias posteriores.

REGRAS DO ALGORITMO

Considerar corretamente o kerf.

Exemplo:

Se duas peças têm:

800 × 400

e o kerf é:

3,2 mm

não devem ser consideradas simplesmente encostadas uma à outra.

O algoritmo deve reservar espaço suficiente para o corte.

Também deve considerar as margens da chapa.

As peças não podem ultrapassar:

comprimento;

largura;

margem definida.

Quando a rotação estiver desativada, respeitar obrigatoriamente a orientação original.

Quando estiver ativada, permitir:

0° ou 90°.

MULTIPLAS CHAPAS

Quando todas as peças não couberem em uma chapa:

utilizar a chapa seguinte;

respeitar quantidade disponível;

agrupar peças do mesmo material sempre que possível;

indicar quais chapas foram utilizadas.

Se uma peça não couber em nenhuma chapa disponível, colocá-la numa lista:

Peças não acomodadas

e explicar o motivo.

VISUALIZAÇÃO DO PLANO DE CORTE

Criar uma área grande de visualização.

Cada chapa deve ser apresentada como um retângulo proporcional às dimensões reais.

Dentro dela:

desenhar cada peça;

mostrar identificação;

mostrar dimensão;

mostrar rotação;

diferenciar visualmente peças e área de sobra.

Ao passar o rato sobre uma peça:

mostrar:

ID;

nome;

dimensão;

rotação;

material;

posição X;

posição Y.

Permitir:

zoom;

pan;

selecionar peça;

visualizar cada chapa individualmente.

Adicionar opção:

Mostrar dimensões

para apresentar medidas no desenho.

ORDEM DOS CORTES

Criar uma função que gere uma sequência sugerida de corte.

Mostrar numa tabela:

Nº | Ação | Medida | Chapa

Exemplo:

Corte horizontal em 1200 mm

Corte vertical em 800 mm

Corte vertical em 450 mm

A arquitetura deve separar:

otimização geométrica;

geração do plano;

geração da sequência de cortes.

Isso será importante para versões futuras.

ESTATÍSTICAS

Depois da otimização mostrar:

Resultado

Chapas utilizadas:
3

Peças colocadas:
28

Peças não colocadas:
0

Área utilizada:
X m²

Área desperdiçada:
X m²

Aproveitamento:
92,4%

Kerf total estimado:
X mm

Número estimado de cortes:
X

SOBRAS

Mostrar as sobras de cada chapa.

Para cada sobra:

comprimento;

largura;

área.

Classificar como:

sobra grande;

sobra média;

sobra pequena.

Preparar a arquitetura para futuramente permitir guardar sobras como material reutilizável.

RELATÓRIO

Criar uma página de relatório profissional.

Mostrar:

nome do projeto;

data;

cliente;

parâmetros;

lista de peças;

chapas utilizadas;

planos de corte;

estatísticas;

sobras;

peças não acomodadas.

EXPORTAÇÃO PDF

Criar uma funcionalidade real de exportação PDF.

O PDF deve conter:

Página 1:
Resumo do projeto

Página 2+:
Uma página por chapa

Cada página da chapa deve mostrar:

desenho do plano de corte;

identificação das peças;

dimensões;

sentido/rotação;

medidas principais.

No final:

aproveitamento;

desperdício;

sobras.

O PDF deve ser legível quando impresso numa oficina.

DESIGN

Interface inspirada em software profissional de engenharia/marcenaria.

Evitar excesso de elementos decorativos.

Priorizar:

rapidez;

legibilidade;

tabelas;

medidas;

números;

diagramas.

Utilizar uma interface responsiva.

Desktop deve ser a experiência principal.

Também deve funcionar razoavelmente em tablet.

VALIDAÇÃO

Adicionar validações:

dimensões devem ser > 0;

quantidade deve ser >= 1;

kerf >= 0;

margem >= 0;

não permitir valores inválidos;

mostrar erros de forma clara.

TESTES

Criar testes automatizados para o algoritmo.

Incluir casos como:

Uma peça numa chapa.

Várias peças iguais.

Peças que precisam ser rodadas.

Peças que não cabem.

Múltiplas chapas.

Kerf de 3,2 mm.

Margem de 10 mm.

Mistura de peças grandes e pequenas.

Orientação fixa.

Orientação livre.

Criar pelo menos alguns testes que verifiquem que:

nenhuma peça fica sobreposta;

nenhuma peça ultrapassa a chapa;

kerf é respeitado;

peças obrigatoriamente orientadas não são rodadas.

DADOS DE EXEMPLO

Criar um projeto inicial de demonstração:

Chapa:

2800 × 2070 mm
MDF 18 mm
Quantidade: 3

Peças:

P001 800 × 400 quantidade 4
P002 700 × 350 quantidade 6
P003 1200 × 300 quantidade 2
P004 450 × 200 quantidade 8
P005 600 × 400 quantidade 3
P006 300 × 250 quantidade 5

Kerf:

3,2 mm

Margem:

10 mm

Usar estes dados para demonstrar o funcionamento da aplicação.

ESTRUTURA DO PROJETO

Organizar o código de forma limpa.

Sugestão:

/app
/components
/lib
/lib/optimizer
/lib/pdf
/lib/cut-sequence
/types
/hooks
/utils
/tests

Criar tipos TypeScript claros para:

Sheet

Part

Placement

CutPlan

OptimizationResult

Project

CutParameters

EXPERIÊNCIA DO UTILIZADOR

O fluxo ideal deve ser:

Criar projeto.

Adicionar chapas.

Adicionar peças.

Definir parâmetros.

Clicar:

OTIMIZAR CORTE

Mostrar o resultado.

Permitir alterar parâmetros.

Recalcular.

Exportar PDF.

O botão de otimização deve mostrar estado de processamento enquanto o cálculo está a decorrer.

PERFORMANCE

A aplicação deve conseguir lidar com listas razoavelmente grandes.

Evitar renderizações desnecessárias.

Separar o algoritmo de otimização da interface.

Para conjuntos maiores de peças, preparar a arquitetura para posteriormente executar a otimização num Web Worker para não bloquear a interface.

FUTURAS FUNCIONALIDADES

Não é necessário implementar agora, mas estruturar o projeto para permitir posteriormente:

importação CSV;

exportação CSV;

DXF;

SVG;

integração CNC;

leitura de sobras guardadas;

biblioteca de materiais;

preços por chapa;

cálculo de custo;

orçamento;

corte de peças em várias chapas;

nesting avançado;

login;

projetos guardados na cloud;

histórico;

impressão;

diferentes tipos de máquina;

otimização específica para serra de esquadria;

otimização para CNC;

nesting de formas não retangulares.

REGRAS IMPORTANTES DE DESENVOLVIMENTO

Primeiro analisa o projeto existente antes de alterar ficheiros.

Não apagues funcionalidades existentes sem motivo.

Não crias código duplicado.

Usa TypeScript corretamente.

Cria componentes reutilizáveis.

Mantém a lógica de negócio fora da UI.

Implementa testes.

Corrige erros de build/lint/testes antes de terminar.

Não deixes funcionalidades principais como placeholders.

Não uses dados falsos para simular resultados do algoritmo.

O plano visual deve ser derivado dos resultados reais do algoritmo.

O PDF deve utilizar os dados reais do plano.

CRITÉRIO DE CONCLUSÃO

Considera a primeira versão concluída somente quando:

a aplicação iniciar corretamente;

for possível criar um projeto;

for possível cadastrar chapas;

for possível cadastrar peças;

for possível definir kerf;

for possível executar otimização;

existir um plano de corte visual real;

as peças não se sobrepuserem;

as dimensões forem respeitadas;

rotação funcionar;

múltiplas chapas funcionarem;

estatísticas forem calculadas;

existir lista de sobras;

existir lista de peças não acomodadas;

existir exportação PDF;

os testes principais passarem;

o projeto fizer build sem erros.

No final, apresenta um resumo do que foi implementado, os principais ficheiros criados/modificados e como executar a aplicação localmente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://precise-panel-optimizer.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35da3da1-9a65-45f7-b4d7-449b170f5267).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Funcionalidades implementadas na revisão

- Otimização multi-estratégia com várias ordens de inserção e validação geométrica.
- Planos entregues com sequência guilhotinável; layouts manuais ficam identificados como ajustados manualmente.
- Kerf e espaçamento extra tratados como folga de separação entre peças.
- Seleção automática de stock por material normalizado e disponibilidade de chapas.
- Importação CSV de peças e modelo CSV.
- Exportação geométrica SVG e DXF (R12); o DXF contém geometrias 2D e deve ser pós-processado conforme a máquina/CAM.
- Custo de material, custo estimado por metro de corte e crédito configurável para sobras.
- Edição manual do plano por arrastar peças, com bloqueio de colisões, margens e espaçamento.
- Persistência em IndexedDB com fallback para localStorage e migração do formato anterior.
- Testes de regressão para rotação, kerf, margens, stock, materiais, modos e custos.

> Nota: o motor continua heurístico. Ele procura uma boa solução executável, não prova a solução matematicamente ótima.

## Modo Corte — Altendorf F40

O projeto inclui um modo de planeamento orientado para uma esquadrejadeira manual: a chapa é organizada em faixas de largura uniforme e cada faixa é posteriormente seccionada no comprimento. O resultado inclui uma sequência de operações com fases de **Rasgo**, **Esquadro** e **Acabamento**.

A primeira página do PDF é a **Lista de Corte — Oficina**, pensada para impressão e utilização junto à máquina. As páginas seguintes apresentam as operações por chapa, o resumo, os planos gráficos e as sobras.

O projeto pode ser exportado/importado como `.cutplan.json` para backup completo. A lista de corte CSV usa `;` e UTF-8 BOM para melhor compatibilidade com Excel em ambientes europeus.
