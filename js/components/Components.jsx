        

        // --- COMPONENTS ---
        const HighlightText = ({ text, highlight }) => {
            if (!highlight || !highlight.trim()) return <span>{text}</span>;
            const regex = new RegExp(`(${highlight})`, 'gi');
            const parts = text.split(regex);
            return (
                <span>
                    {parts.map((part, i) =>
                        regex.test(part) ? <span key={i} className="bg-yellow-500/30 text-yellow-300 px-0.5 rounded">{part}</span> : part
                    )}
                </span>
            );
        };

        // --- APP LOGIC ---

        const processBattleLogs = (data) => {
            const stats = {};
            const history = {};
            const rivalry = {}; 
            const initPlayer = (name) => {
                if (!stats[name]) {
                    stats[name] = { name, wins: 0, losses: 0, battles: 0, winRate: 0, modes: {}, streak: 0, rankedStreak: 0, badges: [] };
                    history[name] = [];
                    rivalry[name] = {};
                }
            };
            const updateModeStats = (playerName, mode, result) => {
                if (!stats[playerName].modes[mode]) { stats[playerName].modes[mode] = { wins: 0, losses: 0, battles: 0, streak: 0 }; }
                stats[playerName].modes[mode].battles += 1;
                if (result === 'win') {
                    stats[playerName].modes[mode].wins += 1;
                    stats[playerName].modes[mode].streak = stats[playerName].modes[mode].streak >= 0 ? stats[playerName].modes[mode].streak + 1 : 1;
                } else {
                    stats[playerName].modes[mode].losses += 1;
                    stats[playerName].modes[mode].streak = stats[playerName].modes[mode].streak <= 0 ? stats[playerName].modes[mode].streak - 1 : -1;
                }
            };
            const updateRivalry = (player, opponent, result) => {
                if (!rivalry[player][opponent]) rivalry[player][opponent] = { wins: 0, losses: 0 };
                if (result === 'win') rivalry[player][opponent].wins += 1; else rivalry[player][opponent].losses += 1;
            }
            if (!Array.isArray(data)) return { rankings: [], history: {} };
            const sortedData = [...data].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            sortedData.forEach(log => {
                const content = log.content || "";
                const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                if (match) {
                    const mode = match[1]; 
                    const winners = match[2].split(',').map(n => n.trim()).filter(n => n.length > 0);
                    const losers = match[3].split(',').map(n => n.trim()).filter(n => n.length > 0);
                    const timestamp = log.timestamp;
                    winners.forEach(winner => {
                        initPlayer(winner); 
                        stats[winner].wins += 1; 
                        stats[winner].battles += 1; 
                        updateModeStats(winner, mode, 'win');
                        history[winner].push({ opponent: losers.join(', '), result: 'win', timestamp: timestamp, mode: mode });
                        
                        // Atualiza Sequência Global e Ranked
                        if (stats[winner].streak >= 0) stats[winner].streak += 1; else stats[winner].streak = 1;
                        if (['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) {
                            if (stats[winner].rankedStreak >= 0) stats[winner].rankedStreak += 1; else stats[winner].rankedStreak = 1;
                        }

                        losers.forEach(loser => updateRivalry(winner, loser, 'win'));
                    });
                    losers.forEach(loser => {
                        initPlayer(loser); 
                        stats[loser].losses += 1; 
                        stats[loser].battles += 1; 
                        updateModeStats(loser, mode, 'loss');
                        history[loser].push({ opponent: winners.join(', '), result: 'loss', timestamp: timestamp, mode: mode });
                        
                        // Atualiza Sequência Global e Ranked
                        if (stats[loser].streak <= 0) stats[loser].streak -= 1; else stats[loser].streak = -1;
                        if (['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) {
                            if (stats[loser].rankedStreak <= 0) stats[loser].rankedStreak -= 1; else stats[loser].rankedStreak = -1;
                        }

                        winners.forEach(winner => updateRivalry(loser, winner, 'loss'));
                    });
                }
            });
            const rankings = Object.values(stats).map(player => {
                let nemesis = { name: null, count: 0 }, victim = { name: null, count: 0 };
                if (rivalry[player.name]) {
                    Object.entries(rivalry[player.name]).forEach(([opp, s]) => {
                        if (s.losses > nemesis.count) nemesis = { name: opp, count: s.losses };
                        if (s.wins > victim.count) victim = { name: opp, count: s.wins };
                    });
                }
                const badges = [];
                const wr = player.battles > 0 ? (player.wins / player.battles) * 100 : 0;
                if (player.battles >= 20 && wr >= 70) badges.push({ id: 'elite', icon: Star, label: 'Elite', color: 'text-yellow-400' });
                return { ...player, winRate: wr.toFixed(1), nemesis: nemesis.count > 0 ? nemesis : null, victim: victim.count > 0 ? victim : null, badges };
            }).sort((a, b) => b.wins - a.wins);
            return { rankings, history };
        };

        const Card = ({ title, value, icon: Icon, colorClass }) => (
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-4 animate-in fade-in duration-500">
                <div className={`p-3 rounded-full ${colorClass} bg-opacity-20`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div>
                <div><p className="text-slate-400 text-sm font-medium">{title}</p><h3 className="text-2xl font-bold text-white">{value}</h3></div>
            </div>
        );
        
        const LiveTicker = ({ logs, mapData = [], blessData = [], t }) => {
            const [isOpen, setIsOpen] = useState(false);

            const sortedLogs = [...logs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            const last1v1 = sortedLogs.find(l => l.content && (l.content.startsWith('[Auto1v1]') || l.content.startsWith('[DBE1v1]')) && l.content.includes(' derrotou '));
            const last2v2 = sortedLogs.find(l => l.content && (l.content.startsWith('[Auto2v2]') || l.content.startsWith('[DBE2v2]')) && l.content.includes(' derrotou '));
            const last3v3 = sortedLogs.find(l => l.content && l.content.startsWith('[Auto3v3]') && l.content.includes(' derrotou '));
            
            const sortedBless = [...blessData].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            const lastXp = sortedBless.find(b => b.type === 'XP');
            const lastDrop = sortedBless.find(b => b.type === 'Drop');

            const renderMatch = (log, label) => {
                if (!log) return null;
                const m = log.content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                if (!m) return null;
                const timeStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                const dateStr = new Date(log.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
                return (
                    <div className="flex flex-col gap-1 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm hover:border-slate-700 transition-colors" title={`[${m[1]}] ${m[2]} derrotou ${m[3]}`}>
                        <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5"><Swords className="w-3 h-3 text-slate-400"/> Último {label}</div>
                            <span className="text-[9px] bg-slate-800 px-1 rounded">{dateStr} {timeStr}</span>
                        </div>
                        <div className="text-sm font-bold truncate">
                            <span className="text-yellow-500">[{m[1]}]</span> <span className="text-blue-400">{m[2]}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">derrotou <span className="text-red-400">{m[3]}</span></div>
                    </div>
                );
            };

            const renderBlessCard = (bless, isXP) => {
                if (!bless) return null;
                const parts = bless.content.split(' abençoou ');
                if (parts.length !== 2) return null;
                const giver = parts[0].replace('[Bênção] ', '');
                const color = isXP ? 'text-pink-400' : 'text-green-400';
                const timeStr = new Date(bless.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                const dateStr = new Date(bless.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
                return (
                    <div className="flex flex-col gap-1 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm hover:border-slate-700 transition-colors" title={`${giver} abençoou ${parts[1]} (${isXP ? 'XP' : 'Drop'})`}>
                        <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5"><Star className={`w-3 h-3 ${color}`}/> Último Bless {isXP ? 'XP' : 'Drop'}</div>
                            <span className="text-[9px] bg-slate-800 px-1 rounded">{dateStr} {timeStr}</span>
                        </div>
                        <div className="text-sm font-bold truncate text-white">{giver}</div>
                        <div className="text-[10px] text-slate-400 truncate">abençoou <span className={color}>{parts[1]}</span></div>
                    </div>
                );
            };

            return (
                <div className="mb-8 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden transition-all duration-300">
                    <button 
                        onClick={() => setIsOpen(!isOpen)} 
                        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Flame className="w-4 h-4 text-red-500 animate-pulse"/> Destaques Recentes
                        </h3>
                        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isOpen && (
                        <div className="p-4 pt-2 border-t border-slate-800/50 bg-slate-900/30 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {renderMatch(last1v1, '1x1')}
                                {renderMatch(last2v2, '2x2')}
                                {renderMatch(last3v3, '3x3')}
                                {renderBlessCard(lastXp, true)}
                                {renderBlessCard(lastDrop, false)}
                            </div>
                        </div>
                    )}
                </div>
            );
        };
        
        const Podium = ({ topPlayers, t }) => {
            if (!topPlayers || topPlayers.length < 3) return null;
            return (
                <div className="flex justify-center items-end h-56 mb-10 mt-12 gap-2 sm:gap-6 animate-in slide-in-from-bottom-4 duration-700">
                    {/* 2nd Place */}
                    <div className="flex flex-col items-center">
                        <div className="w-[4.5rem] h-12 bg-slate-800 rounded-full border-2 border-slate-400 flex items-center justify-center mb-1 shadow-lg shadow-slate-500/20">
                            <Crown className="w-4 h-4 text-slate-400 mr-1"/><span className="text-slate-400 font-bold text-sm">#2</span>
                        </div>
                        <span className="font-bold text-slate-300 text-sm truncate max-w-[80px] sm:max-w-[100px]">{topPlayers[1].name}</span>
                        <div className="flex flex-col items-center mb-2 mt-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                            <span className="text-xs font-bold text-yellow-500 flex items-center gap-1" title={t.t_wins}><Trophy className="w-3 h-3"/> {topPlayers[1].tournamentWins}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{topPlayers[1].wins} V • {topPlayers[1].winRate}%</span>
                        </div>
                        <div className="w-20 sm:w-28 h-24 bg-gradient-to-t from-slate-900 to-slate-800 rounded-t-lg border-t-4 border-slate-400 flex justify-center pt-2 shadow-inner"><span className="text-2xl font-black text-slate-500/50">2</span></div>
                    </div>
                    {/* 1st Place */}
                    <div className="flex flex-col items-center z-10 relative -mx-2 sm:-mx-0">
                        <div className="absolute -top-6 text-yellow-500 animate-bounce"><Star className="w-6 h-6 fill-current drop-shadow-[0_0_8px_rgba(234,179,8,1)]"/></div>
                        <div className="w-20 h-16 bg-slate-800 rounded-full border-2 border-yellow-400 flex items-center justify-center mb-1 shadow-xl shadow-yellow-500/30">
                            <Crown className="w-6 h-6 text-yellow-400 mr-1"/><span className="text-yellow-400 font-bold text-lg">#1</span>
                        </div>
                        <span className="font-black text-yellow-400 text-base truncate max-w-[100px] sm:max-w-[120px] drop-shadow-md">{topPlayers[0].name}</span>
                        <div className="flex flex-col items-center mb-2 mt-1 bg-slate-900/80 px-3 py-1 rounded border border-yellow-500/30 shadow-lg">
                            <span className="text-sm font-black text-yellow-500 flex items-center gap-1" title={t.t_wins}><Trophy className="w-3.5 h-3.5"/> {topPlayers[0].tournamentWins} Torneios</span>
                            <span className="text-[10px] text-slate-300 font-mono">{topPlayers[0].wins} Vitórias • {topPlayers[0].winRate}% WR</span>
                        </div>
                        <div className="w-24 sm:w-32 h-32 bg-gradient-to-t from-yellow-950/40 to-yellow-600/40 rounded-t-lg border-t-4 border-yellow-400 flex justify-center pt-2 shadow-2xl shadow-yellow-900/40"><span className="text-4xl font-black text-yellow-500/50">1</span></div>
                    </div>
                    {/* 3rd Place */}
                    <div className="flex flex-col items-center">
                        <div className="w-[4.5rem] h-12 bg-slate-800 rounded-full border-2 border-amber-700 flex items-center justify-center mb-1 shadow-lg shadow-amber-900/40">
                            <Crown className="w-4 h-4 text-amber-600 mr-1"/><span className="text-amber-600 font-bold text-sm">#3</span>
                        </div>
                        <span className="font-bold text-amber-500 text-sm truncate max-w-[80px] sm:max-w-[100px]">{topPlayers[2].name}</span>
                        <div className="flex flex-col items-center mb-2 mt-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                            <span className="text-xs font-bold text-yellow-500 flex items-center gap-1" title={t.t_wins}><Trophy className="w-3 h-3"/> {topPlayers[2].tournamentWins}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{topPlayers[2].wins} V • {topPlayers[2].winRate}%</span>
                        </div>
                        <div className="w-20 sm:w-28 h-20 bg-gradient-to-t from-slate-900 to-amber-900/30 rounded-t-lg border-t-4 border-amber-700 flex justify-center pt-2 shadow-inner"><span className="text-2xl font-black text-amber-700/50">3</span></div>
                    </div>
                </div>
            );
        };

        const PlayerPerformanceChart = ({ matches, t }) => {
            const [hoveredStat, setHoveredStat] = useState(null);
            const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
            const scrollRef = useRef(null);
            const statsByDate = useMemo(() => {
                const groups = {};
                const sortedMatches = [...matches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                sortedMatches.forEach(match => {
                    const date = new Date(match.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    if (!groups[date]) groups[date] = { date, wins: 0, losses: 0, total: 0 };
                    groups[date].total += 1;
                    if (match.result === 'win') groups[date].wins += 1; else groups[date].losses += 1;
                });
                return Object.values(groups); 
            }, [matches]);
            useLayoutEffect(() => { if (scrollRef.current) setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, 50); }, [statsByDate]);
            const handleMouseMove = (e) => { setTooltipPos({ x: e.clientX, y: e.clientY }); };
            if (statsByDate.length === 0) return null;
            const maxVal = Math.max(...statsByDate.map(d => Math.max(d.wins, d.losses))); 
            return (
                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 mb-4 flex flex-col relative" >
                    {hoveredStat && (<div className="fixed z-50 pointer-events-none bg-slate-800 border border-slate-600 text-slate-100 text-xs rounded px-3 py-2 shadow-xl flex flex-col gap-1 min-w-[100px]" style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 15 }}><span className="font-bold border-b border-slate-700 pb-1 mb-1">{hoveredStat.date}</span><div className="flex justify-between"><span className="text-green-400 font-bold">{t.wins}:</span><span>{hoveredStat.wins}</span></div><div className="flex justify-between"><span className="text-red-400 font-bold">{t.losses}:</span><span>{hoveredStat.losses}</span></div></div>)}
                    <div className="flex justify-between items-start mb-4"><h4 className="text-slate-400 text-xs font-bold uppercase flex items-center gap-2"><TrendingUp className="w-4 h-4 text-yellow-500"/> Desempenho (Dia)</h4></div>
                    <div ref={scrollRef} className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50" onMouseMove={handleMouseMove}><div className="flex items-end gap-3 h-32 px-2 min-w-max">{statsByDate.map((stat, idx) => { const winHeight = stat.wins > 0 ? Math.max((stat.wins / maxVal) * 100, 5) : 0; const lossHeight = stat.losses > 0 ? Math.max((stat.losses / maxVal) * 100, 5) : 0; return (<div key={idx} className="flex flex-col items-center justify-end h-full w-12 min-w-[48px] group relative flex-shrink-0 cursor-default hover:bg-white/5 rounded transition-colors" onMouseEnter={() => setHoveredStat(stat)} onMouseLeave={() => setHoveredStat(null)}><div className="w-full flex items-end justify-center gap-1 h-full px-1"><div className="flex-1 bg-slate-800/30 rounded-t-sm h-full flex items-end relative overflow-hidden"><div style={{ height: `${winHeight}%` }} className={`w-full transition-all duration-300 ${hoveredStat === stat ? 'bg-green-400' : 'bg-green-600'}`}></div></div><div className="flex-1 bg-slate-800/30 rounded-t-sm h-full flex items-end relative overflow-hidden"><div style={{ height: `${lossHeight}%` }} className={`w-full transition-all duration-300 ${hoveredStat === stat ? 'bg-red-400' : 'bg-red-600'}`}></div></div></div><span className={`text-[10px] mt-2 font-mono whitespace-nowrap transition-colors ${hoveredStat === stat ? 'text-white font-bold' : 'text-slate-500'}`}>{stat.date}</span></div>) })}</div></div>
                </div>
            );
        };

        const TournamentModal = ({ tournament, onClose, onPlayerClick, getShareLink, t }) => {
            useLockBodyScroll(); 
            if (!tournament) return null;
            const matches = [...tournament.matches].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const rounds = { 'Final': [matches[0]].filter(Boolean), 'Semifinais': matches.slice(1, 3), 'Quartas de Final': matches.slice(3, 7), 'Classificatórias': matches.slice(7) };
            return (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center p-4 z-[100]" onClick={onClose}>
                    <div className="bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <div><h2 className="text-2xl font-bold text-white flex items-center gap-3"><Trophy className="text-yellow-500 w-6 h-6" />{tournament.name}</h2><p className="text-slate-400 text-sm mt-1">{tournament.date}</p></div>
                            <div className="flex gap-2"><ShareButton url={getShareLink(tournament.name, true)} title={t.share} /><button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"><XIcon className="w-6 h-6" /></button></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-slate-950/50">
                            {Object.entries(rounds).map(([roundName, roundMatches]) => {
                                if (roundMatches.length === 0) return null;
                                return (
                                    <div key={roundName} className="mb-8 last:mb-0"><div className="flex items-center gap-4 mb-4"><div className="h-px bg-slate-700 flex-1"></div><h3 className="text-yellow-500 font-bold uppercase tracking-widest text-sm">{roundName}</h3><div className="h-px bg-slate-700 flex-1"></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">{roundMatches.map((match, idx) => (<div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-colors"><div className="w-full flex justify-between items-center mb-2"><div className="flex flex-wrap gap-1 flex-1">{match.winners.map((name, i) => (<span key={i} onClick={(e) => { e.stopPropagation(); onPlayerClick(name); }} className="text-green-400 font-bold hover:text-white hover:underline cursor-pointer transition-colors">{name}{i < match.winners.length - 1 ? ',' : ''}</span>))}</div><Trophy className="w-4 h-4 text-yellow-500 ml-2 flex-shrink-0" /></div><div className="w-full h-px bg-slate-800 my-1"></div><div className="w-full flex justify-between items-center mt-2 opacity-60"><div className="flex flex-wrap gap-1 flex-1">{match.losers.map((name, i) => (<span key={i} onClick={(e) => { e.stopPropagation(); onPlayerClick(name); }} className="text-red-400 font-medium hover:text-white hover:underline cursor-pointer transition-colors">{name}{i < match.losers.length - 1 ? ',' : ''}</span>))}</div></div><div className="absolute top-2 right-2 text-[10px] text-slate-600 bg-slate-900 px-1 rounded">{new Date(match.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>))}</div></div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        };

        const InfoModal = ({ onClose, t }) => {
            useLockBodyScroll(); 
            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
                    <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><HelpCircle className="w-5 h-5 text-blue-400" />{t.how_to_use}</h2>
                            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 text-slate-300 text-sm leading-relaxed space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
                            <div className="space-y-2">
                                <h3 className="text-yellow-500 font-bold uppercase text-xs tracking-wider">{t.functionalities}</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-slate-600">
                                    <li>{t.features_list_1}</li><li>{t.features_list_2}</li><li>{t.features_list_3}</li><li>{t.features_list_4}</li>
                                </ul>
                            </div>
                            <div className="h-px bg-slate-800 w-full"></div>
                            <div className="space-y-2">
                                <h3 className="text-yellow-500 font-bold uppercase text-xs tracking-wider">{t.icon_legend}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> <span>{t.icon_streak_win}</span></div>
                                    <div className="flex items-center gap-2"><Skull className="w-4 h-4 text-slate-500" /> <span>{t.icon_streak_loss}</span></div>
                                    <div className="flex items-center gap-2"><ShurikenIcon className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(250,204,21,0.8)]" /> <span>{t.icon_master}</span></div>
                                    <div className="flex items-center gap-2"><ShurikenIcon className="w-4 h-4 text-blue-400" /> <span>{t.icon_veteran}</span></div>
                                    <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> <span>{t.icon_elite}</span></div>
                                    <div className="flex items-center gap-2"><Skull className="w-4 h-4 text-red-500" /> <span>{t.icon_nemesis}</span></div>
                                    <div className="flex items-center gap-2"><Swords className="w-4 h-4 text-green-500" /> <span>{t.icon_victim}</span></div>
                                    {/* Novas Conquistas */}
                                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> <span>Invicto (WR 100%)</span></div>
                                    <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-purple-400" /> <span>Azarão (WR &lt; 30%)</span></div>
                                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-pink-400" /> <span>Gladiador Insone (50+ lutas)</span></div>
                                </div>
                            </div>
                            <div className="h-px bg-slate-800 w-full"></div>
                            <div className="space-y-2">
                                <h3 className="text-yellow-500 font-bold uppercase text-xs tracking-wider">{t.about_project}</h3>
                                <p>{t.about_text_1}</p><p className="text-xs text-slate-500">{t.about_text_2}</p><p className="text-xs text-slate-500">{t.about_text_3}</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        const PlayerModal = ({ player, history, tournaments, activeTab, onClose, onNavigateToPlayer, onOpenTournament, getShareLink, t }) => {
            useLockBodyScroll(); 
            const [historyView, setHistoryView] = useState('matches'); 
            const cardRef = useRef(null);

            const handleExport = async () => {
                if (!cardRef.current || typeof html2canvas === 'undefined') return;
                try {
                    const canvas = await html2canvas(cardRef.current, { backgroundColor: '#020617', scale: 2 });
                    const url = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Status_${player.name.replace(/ /g, '_')}.png`;
                    a.click();
                } catch (err) {
                    console.error("Erro ao exportar", err);
                }
            };

            if (!player) return null;
            const allMatches = history[player.name] || [];
            const playerMatches = useMemo(() => {
                if (activeTab === 'Geral') return allMatches;
                if (activeTab === 'Ranked') { return allMatches.filter(match => ['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(match.mode)); }
                return allMatches.filter(match => match.mode === activeTab);
            }, [allMatches, activeTab]);
            const sortedMatches = [...playerMatches].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const { localNemesis, localVictim } = useMemo(() => {
                const rivalryStats = {};
                playerMatches.forEach(match => {
                    const opponents = match.opponent.split(',').map(n => n.trim()).filter(n => n.length > 0);
                    opponents.forEach(opp => { if (!rivalryStats[opp]) rivalryStats[opp] = { wins: 0, losses: 0 }; if (match.result === 'win') rivalryStats[opp].wins++; else rivalryStats[opp].losses++; });
                });
                let bestVictim = { name: null, count: 0 }, worstNemesis = { name: null, count: 0 };
                Object.entries(rivalryStats).forEach(([name, stats]) => { if (stats.wins > bestVictim.count) bestVictim = { name, count: stats.wins }; if (stats.losses > worstNemesis.count) worstNemesis = { name, count: stats.losses }; });
                return { localNemesis: worstNemesis.count > 0 ? worstNemesis : null, localVictim: bestVictim.count > 0 ? bestVictim : null };
            }, [playerMatches]);
            const matchesByDate = sortedMatches.reduce((groups, match) => {
                const date = match.timestamp ? new Date(match.timestamp).toLocaleDateString('pt-BR') : 'Data desconhecida';
                if (!groups[date]) groups[date] = []; groups[date].push(match); return groups;
            }, {});
            const playerTournaments = useMemo(() => {
                if (!tournaments) return [];
                return tournaments.filter(t => t.matches.some(m => m.winners.includes(player.name) || m.losers.includes(player.name))).map(t => {
                    const sortedMatches = [...t.matches].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const lastMatch = sortedMatches[sortedMatches.length - 1];
                    const isWinner = lastMatch && lastMatch.winners.includes(player.name);
                    return { ...t, isWinner };
                });
            }, [tournaments, player.name]);

            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-[80]" onClick={onClose}>
                    <div className="bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800/50 flex-shrink-0">
                            <div className="flex flex-col gap-2">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-0 flex items-center gap-2">{player.name}{parseFloat(player.winRate) >= 60 && <TrendingUp className="w-6 h-6 text-green-400" />}</h2>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-400 items-center mt-1">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-yellow-500 font-bold uppercase tracking-wider">{activeTab}</span>
                                    <span>{player.wins} {t.wins}</span><span>{player.losses} {t.losses}</span><span className={parseFloat(player.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}>{player.winRate}% WR</span><span className="text-yellow-500 font-bold">{player.tournamentWins || 0} {t.t_wins}</span>
                                    {player.badges && player.badges.length > 0 && (<div className="flex items-center gap-2 pl-2">{player.badges.map((badge, idx) => { const BadgeIcon = badge.icon; return (<div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 shadow-sm" title={badge.label}><BadgeIcon className={`w-3.5 h-3.5 ${badge.color}`} /><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide hidden sm:inline-block">{badge.label}</span></div>); })}</div>)}
                                    {(player.displayStreak || 0) >= 3 && (<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-900/30 border border-orange-500/30 shadow-sm ml-2"><Flame className="w-3.5 h-3.5 text-orange-500" /><span className="text-[10px] font-bold text-orange-300 uppercase tracking-wide hidden sm:inline-block">{t.icon_streak_win}</span></div>)}
                                    {(player.displayStreak || 0) <= -3 && (<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-900/30 border border-red-500/30 shadow-sm ml-2"><Skull className="w-3.5 h-3.5 text-red-500" /><span className="text-[10px] font-bold text-red-300 uppercase tracking-wide hidden sm:inline-block">{t.icon_streak_loss}</span></div>)}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleExport} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs transition-colors" title={t.export_card}><CameraIcon className="w-3.5 h-3.5" /><span className="hidden md:inline">{t.export_card}</span></button>
                                <ShareButton generateUrl={() => getShareLink(player)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 h-8" label={t.share} />
                                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-700 rounded-full"><XIcon className="w-6 h-6" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden min-h-0 bg-slate-950" ref={cardRef}>
                            <div className="h-full flex flex-col lg:flex-row-reverse">
                                <div className="w-full lg:w-[45%] p-4 lg:p-6 bg-slate-900 lg:border-l border-b lg:border-b-0 border-slate-800 overflow-y-auto lg:overflow-visible flex-shrink-0">
                                    <PlayerPerformanceChart matches={playerMatches} t={t} />
                                    <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800 w-full">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><InfoIcon className="w-4 h-4 text-blue-500"/> {t.stats_quick}</h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between text-slate-300"><span>{t.total_matches}</span><span className="font-bold">{playerMatches.length}</span></div><div className="flex justify-between text-slate-300"><span>{t.win_rate_label}</span><span className={parseFloat(player.winRate) >= 50 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{player.winRate}%</span></div><div className="h-px bg-slate-800 my-1"></div>
                                            {localNemesis && (<div className="flex justify-between items-center gap-4"><span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0"><Skull className="w-3.5 h-3.5 text-red-500"/> {t.nemesis}</span><div className="text-right overflow-hidden"><span className="text-red-400 font-bold block leading-tight truncate hover:underline cursor-pointer" onClick={() => onNavigateToPlayer(localNemesis.name)}>{localNemesis.name}</span><span className="text-[10px] text-slate-600 whitespace-nowrap">{localNemesis.count} {t.losses}</span></div></div>)}
                                            {localVictim && (<div className="flex justify-between items-center gap-4"><span className="text-slate-400 flex items-center gap-1.5 flex-shrink-0"><Swords className="w-3.5 h-3.5 text-green-500"/> {t.victim}</span><div className="text-right overflow-hidden"><span className="text-green-400 font-bold block leading-tight truncate hover:underline cursor-pointer" onClick={() => onNavigateToPlayer(localVictim.name)}>{localVictim.name}</span><span className="text-[10px] text-slate-600 whitespace-nowrap">{localVictim.count} {t.wins}</span></div></div>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full lg:w-[55%] flex flex-col h-full bg-slate-950/20">
                                    <div className="p-4 lg:p-6 pb-2 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-20 flex-shrink-0 flex justify-between items-center"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock className="w-5 h-5 text-slate-500"/> {t.history}</h3><div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700"><button onClick={() => setHistoryView('matches')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${historyView === 'matches' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t.matches}</button><button onClick={() => setHistoryView('tournaments')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${historyView === 'tournaments' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t.tournaments}</button></div></div>
                                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 pt-0 scrollbar-thin relative">
                                        {historyView === 'matches' ? (
                                            Object.keys(matchesByDate).length > 0 ? (
                                                Object.entries(matchesByDate).map(([date, matches]) => (<div key={date} className="mb-6 last:mb-0"><div className="bg-slate-900 border-b border-slate-800 py-2 mb-3 shadow-md"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-500" /><h4 className="text-slate-300 text-sm font-bold uppercase tracking-wider">{date}</h4><span className="text-xs text-slate-600 font-medium bg-slate-800 px-2 rounded-full border border-slate-700">{matches.length} {t.matches}</span></div></div><div className="space-y-2">{matches.map((match, idx) => (<div key={idx} className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-all ${match.result === 'win' ? 'bg-green-900/5 border-green-500/10 hover:bg-green-900/10' : 'bg-red-900/5 border-red-500/10 hover:bg-red-900/10'}`}><div className="flex flex-col"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 flex items-center gap-1">{match.mode}</span><div className="flex items-center gap-2 text-slate-200 text-sm font-medium flex-wrap"><span className={match.result === 'win' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>{match.result === 'win' ? 'V' : 'D'}</span><span className="text-slate-600">vs</span>{match.opponent.split(',').map((oppName, i, arr) => (<React.Fragment key={i}><span className="hover:text-yellow-400 hover:underline cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); onNavigateToPlayer(oppName.trim()); }}>{oppName.trim()}</span>{i < arr.length - 1 && <span className="text-slate-600 mr-1">,</span>}</React.Fragment>))}</div></div><div className="text-right flex items-center gap-2 text-slate-500 text-xs"><span>{match.timestamp ? new Date(match.timestamp).toLocaleTimeString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).replace(',', '') : '--:--'}</span></div></div>))}</div></div>))
                                            ) : (<div className="text-center py-10 text-slate-500">{t.no_matches}</div>)
                                        ) : (
                                            <div className="space-y-3 mt-4">
                                                {playerTournaments.length > 0 ? playerTournaments.map(tData => (<div key={tData.id} onClick={() => onOpenTournament(tData)} className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-all hover:shadow-md group ${tData.isWinner ? 'bg-yellow-900/10 border-yellow-500/30 hover:border-yellow-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}><div className="flex flex-col"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{tData.date}</span><div className="font-bold text-white group-hover:text-yellow-400 transition-colors flex items-center gap-2">{tData.name}{tData.isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}</div></div><div className="flex items-center gap-3"><span className={`text-xs font-bold px-2 py-1 rounded border ${tData.isWinner ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>{tData.isWinner ? t.won : t.participated}</span><ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white" /></div></div>)) : (<div className="text-center py-10 text-slate-500">{t.no_tournament_period}</div>)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };


// --- GLOBAL EXPORTS ---
window.HighlightText = HighlightText;
window.processBattleLogs = processBattleLogs;
window.Card = Card;
window.LiveTicker = LiveTicker;
window.Podium = Podium;
window.PlayerPerformanceChart = PlayerPerformanceChart;
window.TournamentModal = TournamentModal;
window.InfoModal = InfoModal;
window.PlayerModal = PlayerModal;
