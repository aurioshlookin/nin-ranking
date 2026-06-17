        // --- CONFIG ---
        const CUSTOM_ICON_URL = './icon.png'; 
        const PLAYERS_FILE = './players.json'; 
        const PRIORITY_MODES = ['Auto1v1', 'Auto2v2', 'Auto3v3', 'DBE1v1', 'DBE2v2'];
        
        const TRANSLATIONS = {
            pt: {
                server: "Servidor: Hawk", to: "até",
                search_placeholder: "Buscar jogador...", search_disabled_tooltip: "A pesquisa só está disponível na aba Ranking.",
                ranking: "Ranking", versus: "Versus", tournaments: "Torneios", matches_tab: "Partidas",
                others: "Outros", current_month: "Este Mês", day: "Últimas 24h", week: "Última Semana", specific_month: "Selecionar Mês", all: "Todo o Período", default_desc: "Estatísticas detalhadas para este modo de jogo específico.",
                player1: "Jogador 1", player2: "Jogador 2", no_match: "Nenhum confronto encontrado entre estes jogadores.", winners: "Vencedores", losers: "Perdedores",
                victory_p1: "VITÓRIA J1", defeat_p1: "DERROTA J1", see_tournament: "Ver Torneio", active_players: "Jogadores Ativos", total_battles: "Total de Batalhas", most_wins: "Mais Vitórias", most_losses: "Mais Derrotas", on_fire: "Sequência de Vitórias",
                player: "Jogador", t_wins: "T. Vencidos", t_played: "T. Jogados", wins: "Vitórias", losses: "Derrotas", battles: "Partidas", win_rate: "Win Rate",
                no_player_found: "Nenhum jogador encontrado para este filtro.", date: "Data", tournament: "Torneio", time: "Horário", no_tournament_found: "Nenhum torneio encontrado para este filtro.",
                files_loaded: "Arquivos carregados:",
                custom_date: "Personalizado", live_ticker: "AO VIVO", export_card: "Exportar Cartão",
                clear_versus: "Limpar", direct_match: "Confronto Direto",
                search_matches: "Pesquisar Partidas", player_optional: "Jogador (Opcional)",
                comps_title: "Ranking de Duplas e Trios", sort_best: "Top Melhores", sort_worst: "Top Piores", duos: "Top 10 Duplas", trios: "Top 10 Trios",
                top_rivalries: "Top 10 Maiores Rivalidades", top_victims: "Top 10 Vítimas", top_nemesis: "Top 10 Nêmesis",
                // Modals
                how_to_use: "Como usar o site", functionalities: "Funcionalidades", features_list_1: "Ranking: Veja os melhores jogadores do servidor. Clique em um nome para ver o histórico de partidas e gráficos de desempenho.",
                features_list_2: "Torneios: Acesse a lista de torneios passados. Clique em um torneio para visualizar as chaves (brackets) e o progresso das lutas.", features_list_3: "Filtros: Use os filtros de modo (Geral, Ranked, etc.) e data para refinar os resultados.",
                features_list_4: "Versus: Compare o desempenho direto entre dois jogadores.", icon_legend: "Legenda de Ícones",
                icon_streak_win: "3+ Vitórias Seguidas", icon_streak_loss: "3+ Derrotas Seguidas", icon_master: "Ninja Mestre (1000+ partidas)", icon_veteran: "Ninja Veterano (100+ partidas)",
                icon_elite: "Elite (WR >= 70%)", icon_nemesis: "Nêmesis (Quem mais te venceu)", icon_victim: "Vítima (Quem você mais venceu)", about_project: "Sobre o Projeto",
                about_text_1: "Este painel foi desenvolvido por Auriosh.", about_text_2: "É um projeto sem fins lucrativos e não remunerado, criado para a comunidade.", about_text_3: "A atualização dos dados é feita manualmente através das informações divulgadas no canal oficial Servidor do Discord.",
                share: "Compartilhar", won: "VENCEU", participated: "PARTICIPOU", no_tournament_period: "Nenhum torneio encontrado neste período.", stats_quick: "Estatísticas Rápidas",
                total_matches: "Total Partidas", win_rate_label: "Taxa de Vitória", nemesis: "Nêmesis", victim: "Vítima", history: "Histórico", matches: "Partidas", loading: "A carregar...", error_loading: "Erro ao carregar dados", try_again: "Tentar Novamente"
            },
            en: {
                server: "Server: Hawk", to: "to",
                search_placeholder: "Search player...", search_disabled_tooltip: "Search is only available in the Ranking tab.",
                ranking: "Ranking", versus: "Versus", tournaments: "Tournaments", matches_tab: "Matches",
                others: "Others", current_month: "This Month", day: "Last 24h", week: "Last Week", specific_month: "Select Month", all: "All Time", default_desc: "Detailed statistics for this specific game mode.",
                player1: "Player 1", player2: "Player 2", no_match: "No match found between these players.", winners: "Winners", losers: "Losers",
                victory_p1: "P1 VICTORY", defeat_p1: "P1 DEFEAT", see_tournament: "View Tournament", active_players: "Active Players", total_battles: "Total Battles", most_wins: "Most Wins", most_losses: "Most Losses", on_fire: "Win Streak",
                player: "Player", t_wins: "T. Won", t_played: "T. Played", wins: "Wins", losses: "Losses", battles: "Matches", win_rate: "Win Rate",
                no_player_found: "No player found for this filter.", date: "Date", tournament: "Tournament", time: "Time", no_tournament_found: "No tournament found for this filter.",
                files_loaded: "Files loaded:",
                custom_date: "Custom", live_ticker: "LIVE", export_card: "Export Card",
                clear_versus: "Clear", direct_match: "Direct Match",
                search_matches: "Search Matches", player_optional: "Player (Optional)",
                comps_title: "Duos and Trios Ranking", sort_best: "Top Best", sort_worst: "Top Worst", duos: "Top 10 Duos", trios: "Top 10 Trios",
                top_rivalries: "Top 10 Biggest Rivalries", top_victims: "Top 10 Victims", top_nemesis: "Top 10 Nemeses",
                // Modals
                how_to_use: "How to use", functionalities: "Features", features_list_1: "Ranking: See the best players on the server. Click a name to see match history and performance charts.",
                features_list_2: "Tournaments: Access past tournaments list. Click a tournament to view brackets and fight progress.", features_list_3: "Filters: Use mode (General, Ranked, etc.) and date filters to refine results.",
                features_list_4: "Versus: Compare direct performance between two players.", icon_legend: "Icon Legend",
                icon_streak_win: "3+ Win Streak", icon_streak_loss: "3+ Loss Streak", icon_master: "Master Ninja (1000+ matches)", icon_veteran: "Veteran Ninja (100+ matches)",
                icon_elite: "Elite (WR >= 70%)", icon_nemesis: "Nemesis (Who beat you most)", icon_victim: "Victim (Who you beat most)", about_project: "About Project",
                about_text_1: "This panel was developed by Auriosh.", about_text_2: "It is a non-profit, unpaid project created for the community.", about_text_3: "Data updates are done manually using information released on the official Discord Server channel.",
                share: "Share", won: "WON", participated: "PARTICIPATED", no_tournament_period: "No tournament found in this period.", stats_quick: "Quick Stats",
                total_matches: "Total Matches", win_rate_label: "Win Rate", nemesis: "Nemesis", victim: "Victim", history: "History", matches: "Matches", loading: "Loading...", error_loading: "Error loading data", try_again: "Try Again"
            }
        };

        const MODE_DESCRIPTIONS = {
            pt: {
                'Geral': 'Visão geral de todas as partidas registradas no servidor.',
                'Ranked': 'Soma das filas ranqueadas (Auto1v1, Auto2v2, Auto3v3).',
                'Auto1v1': 'Partidas ranqueadas automáticas 1v1.',
                'Auto2v2': 'Partidas ranqueadas automáticas 2v2.',
                'Auto3v3': 'Partidas ranqueadas automáticas 3v3.',
                'DBE1v1': 'Evento Dodge Ball 1v1.',
                'DBE2v2': 'Evento Dodge Ball 2v2.'
            },
            en: {
                'Geral': 'Overview of all matches registered on the server.',
                'Ranked': 'Sum of automated ranked queues (Auto1v1, Auto2v2, Auto3v3).',
                'Auto1v1': 'Automated ranked 1v1 matches.',
                'Auto2v2': 'Automated ranked 2v2 matches.',
                'Auto3v3': 'Automated ranked 3v3 matches.',
                'DBE1v1': 'Dodge Ball Event 1v1.',
                'DBE2v2': 'Dodge Ball Event 2v2.'
            }
        };

        const Skeleton = ({ className }) => <div className={`animate-pulse bg-slate-800 rounded ${className}`}></div>;

        const SortIndicator = ({ active, direction }) => {
            if (!active) return <span className="ml-1 text-slate-700 opacity-20"><ChevronDown className="w-3 h-3 inline" /></span>; 
            return direction === 'asc' 
                ? <ChevronUp className="w-3 h-3 inline ml-1 text-yellow-500" />
                : <ChevronDown className="w-3 h-3 inline ml-1 text-yellow-500" />;
        };

        const ShareButton = ({ generateUrl, className, label }) => {
            const handleShare = () => {
                const url = generateUrl();
                const textArea = document.createElement("textarea");
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    alert("Link copiado!");
                } catch (err) {
                    console.error('Error copying link', err);
                }
                document.body.removeChild(textArea);
            };

            return (
                <button 
                    onClick={handleShare} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs transition-colors ${className || 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    title="Copiar link"
                >
                    <ShareIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            );
        };

        const LanguageSwitcher = ({ currentLang, setLang }) => (
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 ml-2">
                <button onClick={() => setLang('pt')} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${currentLang === 'pt' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>PT</button>
                <button onClick={() => setLang('en')} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${currentLang === 'en' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>EN</button>
            </div>
        );


// --- GLOBAL EXPORTS ---
window.CUSTOM_ICON_URL = CUSTOM_ICON_URL;
window.PLAYERS_FILE = PLAYERS_FILE;
window.PRIORITY_MODES = PRIORITY_MODES;
window.TRANSLATIONS = TRANSLATIONS;
window.MODE_DESCRIPTIONS = MODE_DESCRIPTIONS;
window.Skeleton = Skeleton;
window.SortIndicator = SortIndicator;
window.ShareButton = ShareButton;
window.LanguageSwitcher = LanguageSwitcher;
