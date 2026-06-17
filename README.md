# Nin Online - Ranking & Tournaments Dashboard

Este projeto é um dashboard interativo (Ranking e Destaques) criado para acompanhar em tempo real as estatísticas de batalhas, conquistas de mapas e bênçãos do servidor de Nin Online (Hawk Server).

## 🚀 Funcionalidades

- **Destaques Recentes:** Feed dinâmico que exibe as últimas batalhas 1x1, 2x2, 3x3, além de bênçãos de XP e Drop com seus respectivos horários de acontecimento.
- **Tabela de Classificação:** Ranking ranqueado por Win Rate, Vitórias ou Total de Batalhas, com busca de jogador integrada.
- **Sistema de Torneios:** Um modal interativo que exibe o pódio e o histórico de lutas (chaves) de cada torneio de maneira isolada.
- **Modos de Visualização:** Alterne a visualização entre Ranking Geral, Partidas Individuais, Bênçãos e Conquistas de Mapas.
- **Filtragem de Data:** Filtros que permitem separar as estatísticas pelas últimas 24 horas, última semana, mês atual, meses específicos ou todo o período.

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3**
- **Tailwind CSS** (via CDN para estilização rápida e responsiva)
- **React.js & Babel** (Standalone para componentes dinâmicos no lado do cliente)
- **Firebase Firestore** (Integração em tempo real com o banco de dados do Nin Online)

## 📁 Estrutura de Arquivos

- `index.html`: O ponto de entrada da aplicação que carrega as dependências e o esqueleto base.
- `css/styles.css`: Estilizações adicionais e customizações do Tailwind (ex: animações de fade in e scrollbars personalizadas).
- `js/components/`: Contém os componentes React modulares (Ícones, Gráficos, Paineis de Destaque, Modais).
- `js/App.jsx`: Arquivo principal que lida com as requisições ao Firebase, controle de estados globais e lógica de renderização principal.
- `icon.png`: Ícone da aba da página (Favicon).

## ⚙️ Como Executar e Implantar

Por ser uma aplicação inteiramente *Client-Side* e não possuir dependências complexas de build (como Node.js/Webpack obrigatórios, pois usa Babel Standalone), a execução é extremamente simples:

1. **Testando Localmente:**
   Basta abrir o arquivo `index.html` em qualquer navegador moderno. Para evitar problemas de CORS, é recomendado utilizar uma extensão de Live Server ou rodar um servidor HTTP local simples:
   ```bash
   python -m http.server 8080
   ```
2. **Implantação (Deploy no GitHub Pages):**
   Como esta pasta contém apenas arquivos estáticos (`.html`, `.css`, `.js`), você pode subir este diretório diretamente para o seu repositório no GitHub e ativar o recurso **GitHub Pages**. A aplicação rodará em produção instantaneamente!

---
*Desenvolvido para a comunidade do Nin Online - Hawk Server.*
