        

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
            const [now, setNow] = useState(new Date());

            useEffect(() => {
                const timer = setInterval(() => setNow(new Date()), 1000);
                return () => clearInterval(timer);
            }, []);

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
                
                const blessTime = new Date(bless.timestamp);
                const timeStr = blessTime.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                
                const diffMs = now.getTime() - blessTime.getTime();
                const oneHourMs = 60 * 60 * 1000;
                const isExpired = diffMs >= oneHourMs;

                let timerStr;
                if (isExpired) {
                    timerStr = "Expirado";
                } else {
                    const remainingMs = oneHourMs - diffMs;
                    const mins = Math.floor(remainingMs / 60000);
                    const secs = Math.floor((remainingMs % 60000) / 1000);
                    timerStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }

                return (
                    <div className="flex flex-col gap-1 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm hover:border-slate-700 transition-colors" title={`${giver} abençoou ${parts[1]} (${isXP ? 'XP' : 'Drop'})`}>
                        <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5"><Star className={`w-3 h-3 ${color}`}/> Último Bless {isXP ? 'XP' : 'Drop'}</div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400 animate-pulse font-mono'}`}>{timerStr}</span>
                        </div>
                        <div className="text-sm font-bold truncate text-white">{giver}</div>
                        <div className="text-[10px] text-slate-400 truncate">abençoou <span className={color}>{parts[1]}</span> às {timeStr}</div>
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

        const MASTERY_ICONS = {
            'Fire': './maestrias/Fire.webp',
            'Water': './maestrias/Water.webp',
            'Water (Bubble)': './maestrias/Bubble.png',
            'Wind': './maestrias/Wind.webp',
            'Wind (Fan)': './maestrias/Fan.png',
            'Earth': './maestrias/Earth.webp',
            'Lightning': './maestrias/Lightning.webp',
            'Medical': './maestrias/Medical.webp',
            'Taijutsu': './maestrias/Taijutsu.webp',
            'Taijutsu (Gentle Fist)': './maestrias/Gentle Fist.png',
            'Weapon': './maestrias/Weapon.webp',
            'Weapon (STR)': './maestrias/Weapon STR.png',
            'Weapon (INT)': './maestrias/Weapon.webp'
        };
        window.MASTERY_ICONS = MASTERY_ICONS;

        const MasteryBadge = ({ mastery, size = 'sm' }) => {
            if (!mastery || mastery === 'None') return null;
            const isAdv = mastery && mastery.startsWith('Advanced ');
            const cleanName = isAdv ? mastery.replace('Advanced ', '') : mastery;
            
            const styles = {
                'Fire': 'bg-red-950/80 text-red-400 border-red-500/40 shadow-red-500/10',
                'Water': 'bg-blue-950/80 text-blue-400 border-blue-500/40 shadow-blue-500/10',
                'Water (Bubble)': 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10',
                'Wind': 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
                'Wind (Fan)': 'bg-teal-950/80 text-teal-300 border-teal-500/40 shadow-teal-500/10',
                'Earth': 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-amber-500/10',
                'Lightning': 'bg-yellow-950/80 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10',
                'Medical': 'bg-teal-950/80 text-teal-300 border-teal-500/40 shadow-teal-500/10',
                'Taijutsu': 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-rose-500/10',
                'Taijutsu (Gentle Fist)': 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10',
                'Weapon': 'bg-slate-800 text-slate-300 border-slate-600/40 shadow-slate-500/10',
                'Weapon (STR)': 'bg-orange-950/80 text-orange-300 border-orange-500/40 shadow-orange-500/10',
                'Weapon (INT)': 'bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-purple-500/10'
            };
            
            const baseStyle = styles[cleanName] || 'bg-slate-800 text-slate-400 border-slate-700';
            const iconSrc = MASTERY_ICONS[cleanName];
            const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : (size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]');
            const imgClass = size === 'xs' ? 'w-3 h-3' : (size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5');
            
            return (
                <span className={`inline-flex items-center gap-1.5 font-bold rounded border shadow-sm ${baseStyle} ${pad} ${isAdv ? 'ring-1 ring-yellow-400/50' : ''}`}>
                    {iconSrc ? (
                        <img src={iconSrc} alt={cleanName} className={`${imgClass} object-contain inline-block shrink-0`} />
                    ) : (
                        <span>✨</span>
                    )}
                    <span>{mastery}</span>
                </span>
            );
        };

        const VillageBadge = ({ village, size = 'sm' }) => {
            if (!village) return null;
            const isRogue = village.includes('Rogue');
            let style = 'bg-slate-800 text-slate-300 border-slate-700';
            let icon = '⛩️';
            
            if (village === 'Leaf') { style = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'; icon = '🍃'; }
            else if (village === 'Sand') { style = 'bg-amber-950/60 text-amber-400 border-amber-500/30'; icon = '🏜️'; }
            else if (village === 'Mist') { style = 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30'; icon = '🌫️'; }
            else if (isRogue) { style = 'bg-red-950/70 text-red-400 border-red-500/40 ring-1 ring-red-500/30'; icon = '🩸'; }
            
            const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : (size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]');
            return (
                <span className={`inline-flex items-center gap-1 font-bold rounded-full border shadow-sm ${style} ${pad}`}>
                    <span>{icon}</span>
                    <span>{village}</span>
                </span>
            );
        };

        const NinjaDetailsModal = ({ ninja, onClose, t }) => {
            useLockBodyScroll();
            if (!ninja) return null;

            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-[90]" onClick={onClose}>
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                                    {ninja.Name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                                        {ninja.Name}
                                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Lv. {ninja.Level}</span>
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <VillageBadge village={ninja.ParsedVillage} size="xs" />
                                        <span className="text-xs text-slate-400 font-semibold">{ninja.ParsedRank}</span>
                                        {ninja.ParsedClan && ninja.ParsedClan !== 'Clanless' && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">🧬 {ninja.ParsedClan}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-700 rounded-full transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Maestrias & Arma */}
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">⚡ {t.mastery}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {ninja.ParsedMasteries && ninja.ParsedMasteries.map((m, idx) => (
                                            <MasteryBadge key={idx} mastery={m} size="md" />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">🗡️ Arma Equipada:</span>
                                    {ninja.EquippedWeapon && ninja.EquippedWeapon !== 'None' ? (
                                        <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-700 text-yellow-300 font-bold">
                                            {ninja.EquippedWeapon}
                                        </span>
                                    ) : (
                                        <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 font-semibold">
                                            Desarmado / Nenhuma
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Estatísticas Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">⚔️ {t.pvp_kills}</span>
                                    <span className="text-lg font-black text-red-400">{ninja.PvpKills || 0}</span>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">⭐ {t.fame}</span>
                                    <span className="text-lg font-black text-yellow-400">{ninja.FamePoints || 0}</span>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">🛡️ Guild</span>
                                    <span className="text-sm font-bold text-slate-200 truncate block">{ninja.GuildName || '-'}</span>
                                </div>
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">🏛️ Corporação</span>
                                    <span className="text-sm font-bold text-slate-200 truncate block">{ninja.CorporationName || '-'}</span>
                                </div>
                            </div>

                            {/* Linha do Tempo de Evolução */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-blue-400" />
                                    {t.change_history}
                                </h4>
                                <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2.5 max-h-48 overflow-y-auto">
                                    {ninja.ChangeHistory && ninja.ChangeHistory.length > 0 ? (
                                        ninja.ChangeHistory.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                                                <span className="text-yellow-500 font-bold">•</span>
                                                <span>{item}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">{t.no_changes_recorded}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        const BingoBookView = ({ bingoData, t }) => {
            const [searchTerm, setSearchTerm] = useState('');
            const [selectedVillage, setSelectedVillage] = useState('All');
            const [selectedMastery, setSelectedMastery] = useState('All');
            const [selectedClan, setSelectedClan] = useState('All');
            const [sortBy, setSortBy] = useState('level');
            const [selectedNinja, setSelectedNinja] = useState(null);

            const villages = ['All', 'Leaf', 'Sand', 'Mist', 'Rogue Leaf', 'Rogue Sand', 'Rogue Mist'];
            const masteries = [
                'All', 
                'Fire', 'Water', 'Wind', 'Earth', 'Lightning', 'Medical', 'Taijutsu', 'Weapon',
                'Water (Bubble)', 'Wind (Fan)', 'Taijutsu (Gentle Fist)', 'Weapon (STR)', 'Weapon (INT)'
            ];
            
            const clans = useMemo(() => {
                const set = new Set();
                bingoData.forEach(n => { if (n.ParsedClan && n.ParsedClan !== 'Clanless') set.add(n.ParsedClan); });
                return ['All', ...Array.from(set).sort()];
            }, [bingoData]);

            const filteredNinjas = useMemo(() => {
                let list = [...bingoData];

                if (searchTerm) {
                    const q = searchTerm.toLowerCase();
                    list = list.filter(n => n.Name.toLowerCase().includes(q) || (n.GuildName && n.GuildName.toLowerCase().includes(q)));
                }

                if (selectedVillage !== 'All') {
                    list = list.filter(n => n.ParsedVillage === selectedVillage);
                }

                if (selectedMastery !== 'All') {
                    if (selectedMastery === 'Weapon') {
                        list = list.filter(n => n.ParsedMasteries && n.ParsedMasteries.some(m => m.includes('Weapon')));
                    } else {
                        list = list.filter(n => n.ParsedMasteries && n.ParsedMasteries.some(m => {
                            const clean = m.replace(/^Advanced\s+/i, '').trim();
                            return clean === selectedMastery;
                        }));
                    }
                }

                if (selectedClan !== 'All') {
                    list = list.filter(n => n.ParsedClan === selectedClan);
                }

                list.sort((a, b) => {
                    if (sortBy === 'level') return (b.Level || 0) - (a.Level || 0) || (b.PvpKills || 0) - (a.PvpKills || 0);
                    if (sortBy === 'kills') return (b.PvpKills || 0) - (a.PvpKills || 0) || (b.Level || 0) - (a.Level || 0);
                    if (sortBy === 'fame') return (b.FamePoints || 0) - (a.FamePoints || 0);
                    if (sortBy === 'name') return a.Name.localeCompare(b.Name);
                    return 0;
                });

                return list;
            }, [bingoData, searchTerm, selectedVillage, selectedMastery, selectedClan, sortBy]);

            return (
                <div className="space-y-6">
                    {selectedNinja && (
                        <NinjaDetailsModal ninja={selectedNinja} onClose={() => setSelectedNinja(null)} t={t} />
                    )}

                    {/* Top Stats Banner */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">👥 Total de Ninjas</span>
                            <span className="text-2xl font-black text-white">{bingoData.length}</span>
                        </div>
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">🏆 Nível Máximo (Lv 70)</span>
                            <span className="text-2xl font-black text-yellow-400">{bingoData.filter(n => n.Level === 70).length}</span>
                        </div>
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">🩸 Renegados (Rogues)</span>
                            <span className="text-2xl font-black text-red-400">{bingoData.filter(n => (n.ParsedVillage || '').includes('Rogue')).length}</span>
                        </div>
                        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">⚡ Maestrias Avançadas</span>
                            <span className="text-2xl font-black text-cyan-400">{bingoData.filter(n => (n.ParsedMasteries || []).some(m => m.startsWith('Advanced'))).length}</span>
                        </div>
                    </div>

                    {/* Filtros e Busca */}
                    <div className="bg-slate-900/90 p-4 md:p-6 rounded-2xl border border-slate-800 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="relative w-full md:w-80">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder={t.search_ninja_placeholder}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                <select 
                                    value={selectedMastery} 
                                    onChange={(e) => setSelectedMastery(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="All">{t.filter_mastery}</option>
                                    {masteries.slice(1).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>

                                <select 
                                    value={selectedClan} 
                                    onChange={(e) => setSelectedClan(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="All">{t.filter_clan}</option>
                                    {clans.slice(1).map(c => <option key={c} value={c}>🧬 {c}</option>)}
                                </select>

                                <select 
                                    value={sortBy} 
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-yellow-400 focus:outline-none focus:border-yellow-500"
                                >
                                    <option value="level">🔼 {t.sort_level}</option>
                                    <option value="kills">⚔️ {t.sort_kills}</option>
                                    <option value="fame">⭐ {t.sort_fame}</option>
                                    <option value="name">🔤 {t.sort_name}</option>
                                </select>
                            </div>
                        </div>

                        {/* Village Pills */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                            {villages.map(v => (
                                <button
                                    key={v}
                                    onClick={() => setSelectedVillage(v)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedVillage === v ? 'bg-yellow-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}
                                >
                                    {v === 'All' ? t.filter_village : v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ninjas Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredNinjas.map((ninja, index) => (
                            <div 
                                key={ninja.Name || index}
                                onClick={() => setSelectedNinja(ninja)}
                                className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xl flex flex-col justify-between gap-3 group"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-black text-sm group-hover:border-yellow-500/50 transition-colors">
                                            {ninja.Name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors flex items-center gap-1.5">
                                                {ninja.Name}
                                            </h4>
                                            <span className="text-[11px] text-slate-400">{ninja.GuildName !== '-' ? ninja.GuildName : 'Sem Guild'}</span>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-black rounded">
                                        Lv. {ninja.Level}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 items-center">
                                    <VillageBadge village={ninja.ParsedVillage} size="xs" />
                                    {ninja.ParsedClan && ninja.ParsedClan !== 'Clanless' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                            🧬 {ninja.ParsedClan}
                                        </span>
                                    )}
                                    {ninja.EquippedWeapon && ninja.EquippedWeapon !== 'None' ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 text-yellow-300 border border-slate-800 flex items-center gap-1" title="Arma equipada">
                                            🗡️ {ninja.EquippedWeapon}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-950/60 text-slate-500 border border-slate-800/80 flex items-center gap-1" title="Desarmado">
                                            🗡️ Desarmado
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800/80">
                                    {ninja.ParsedMasteries && ninja.ParsedMasteries.map((m, idx) => (
                                        <MasteryBadge key={idx} mastery={m} size="xs" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredNinjas.length === 0 && (
                        <div className="text-center py-16 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                            <ScrollIcon className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                            <p className="font-bold text-sm">Nenhum ninja encontrado para este filtro.</p>
                        </div>
                    )}
                </div>
            );
        };

        const PlayerModal = ({ player, history, tournaments, activeTab, onClose, onNavigateToPlayer, onOpenTournament, getShareLink, bingoData, t }) => {
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

            // Dados do Bingo Oficial do Jogo
            const officialNinja = useMemo(() => {
                if (!bingoData || !Array.isArray(bingoData)) return null;
                return bingoData.find(n => n.Name && n.Name.toLowerCase() === player.name.toLowerCase());
            }, [bingoData, player.name]);

            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-[80]" onClick={onClose}>
                    <div className="bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 sm:p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800/50 flex-shrink-0">
                            <div className="flex flex-col gap-2">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-0 flex items-center gap-2">{player.name}{parseFloat(player.winRate) >= 60 && <TrendingUp className="w-6 h-6 text-green-400" />}</h2>
                                <div className="flex flex-wrap gap-3 text-sm text-slate-400 items-center mt-1">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-xs text-yellow-500 font-bold uppercase tracking-wider">{activeTab}</span>
                                    <span>{player.wins} {t.wins}</span><span>{player.losses} {t.losses}</span><span className={parseFloat(player.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}>{player.winRate}% WR</span><span className="text-yellow-500 font-bold">{player.tournamentWins || 0} {t.t_wins}</span>
                                    
                                    {/* Badges Oficiais do Nin Online se cadastrado no Bingo */}
                                    {officialNinja && (
                                        <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                                            <VillageBadge village={officialNinja.ParsedVillage} size="xs" />
                                            {officialNinja.ParsedClan && officialNinja.ParsedClan !== 'Clanless' && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                                    🧬 {officialNinja.ParsedClan}
                                                </span>
                                            )}
                                            {officialNinja.ParsedMasteries && officialNinja.ParsedMasteries.map((m, idx) => (
                                                <MasteryBadge key={idx} mastery={m} size="xs" />
                                            ))}
                                        </div>
                                    )}

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


        // --- MASTERY ANALYTICS COMPONENTS ---
        const ALL_MASTERIES = [
            { id: 'Fire', name: 'Fire', labelPt: 'Fogo', shortPt: 'Fogo', icon: MASTERY_ICONS['Fire'], badgeColor: 'border-red-500/40 bg-red-500/10 text-red-400' },
            { id: 'Water', name: 'Water', labelPt: 'Água', shortPt: 'Água', icon: MASTERY_ICONS['Water'], badgeColor: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
            { id: 'Water (Bubble)', name: 'Water (Bubble)', labelPt: 'Água (Bolha)', shortPt: 'Bolha', icon: MASTERY_ICONS['Water (Bubble)'], badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
            { id: 'Wind', name: 'Wind', labelPt: 'Vento', shortPt: 'Vento', icon: MASTERY_ICONS['Wind'], badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
            { id: 'Wind (Fan)', name: 'Wind (Fan)', labelPt: 'Vento (Leque)', shortPt: 'Leque', icon: MASTERY_ICONS['Wind (Fan)'], badgeColor: 'border-teal-500/40 bg-teal-500/10 text-teal-300' },
            { id: 'Earth', name: 'Earth', labelPt: 'Terra', shortPt: 'Terra', icon: MASTERY_ICONS['Earth'], badgeColor: 'border-amber-600/40 bg-amber-600/10 text-amber-400' },
            { id: 'Lightning', name: 'Lightning', labelPt: 'Raio', shortPt: 'Raio', icon: MASTERY_ICONS['Lightning'], badgeColor: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-400' },
            { id: 'Medical', name: 'Medical', labelPt: 'Médica', shortPt: 'Médica', icon: MASTERY_ICONS['Medical'], badgeColor: 'border-teal-400/40 bg-teal-400/10 text-teal-300' },
            { id: 'Taijutsu', name: 'Taijutsu', labelPt: 'Taijutsu', shortPt: 'Tai', icon: MASTERY_ICONS['Taijutsu'], badgeColor: 'border-orange-500/40 bg-orange-500/10 text-orange-400' },
            { id: 'Taijutsu (Gentle Fist)', name: 'Taijutsu (Gentle Fist)', labelPt: 'Gentle Fist', shortPt: 'GF', icon: MASTERY_ICONS['Taijutsu (Gentle Fist)'], badgeColor: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' },
            { id: 'Weapon (STR)', name: 'Weapon (STR)', labelPt: 'Armas (STR)', shortPt: 'WM (STR)', icon: MASTERY_ICONS['Weapon (STR)'], badgeColor: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
            { id: 'Weapon (INT)', name: 'Weapon (INT)', labelPt: 'Armas (INT)', shortPt: 'WM (INT)', icon: MASTERY_ICONS['Weapon (INT)'], badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300' }
        ];

        const ALL_BASE_MASTERIES = ALL_MASTERIES;
        const ALL_SUB_MASTERIES = ALL_MASTERIES.filter(m => m.name.includes('('));

        const isMutuallyExclusive = (m1, m2) => {
            if (m1 === m2) return false;

            const baseOf = (m) => {
                if (m.startsWith('Water')) return 'Water';
                if (m.startsWith('Wind')) return 'Wind';
                if (m.startsWith('Taijutsu')) return 'Taijutsu';
                if (m.startsWith('Weapon')) return 'Weapon';
                return m;
            };
            if (baseOf(m1) === baseOf(m2)) return true;

            const isBubble = m1.includes('(Bubble)') || m2.includes('(Bubble)');
            const isFan = m1.includes('(Fan)') || m2.includes('(Fan)');
            const isGF = m1.includes('(Gentle Fist)') || m2.includes('(Gentle Fist)');

            if ((isBubble && isFan) || (isBubble && isGF) || (isFan && isGF)) {
                return true;
            }

            // Bubble, Fan, and GF are STR variants and cannot combine with Weapon (INT)
            const hasWMInt = m1.includes('Weapon (INT)') || m2.includes('Weapon (INT)');
            if ((isGF && hasWMInt) || (isBubble && hasWMInt) || (isFan && hasWMInt)) {
                return true;
            }

            return false;
        };

        const MasteryComboModal = ({ comboData, onClose, onSelectNinja, t, rankingsMap }) => {
            useLockBodyScroll();
            const [filterSearch, setFilterSearch] = React.useState('');
            if (!comboData) return null;

            const { m1, m2, isSingle, ninjas } = comboData;

            const filteredList = ninjas.filter(n => 
                !filterSearch || (n.Name && n.Name.toLowerCase().includes(filterSearch.toLowerCase()))
            );

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overscroll-contain animate-in fade-in duration-200" onClick={onClose}>
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] overscroll-contain animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
                                    <GridIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-black text-white">
                                            {comboData.isPresence ? `Ninjas com ${m1}` : (isSingle ? `Ninjas com Apenas ${m1}` : `Combinação: ${m1} + ${m2}`)}
                                        </h3>
                                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold font-mono">
                                            {ninjas.length} {ninjas.length === 1 ? 'ninja' : 'ninjas'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <MasteryBadge mastery={m1} size="xs" />
                                        {!isSingle && <span className="text-slate-500 text-xs font-bold">+</span>}
                                        {!isSingle && <MasteryBadge mastery={m2} size="xs" />}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text" 
                                    placeholder="Filtrar ninjas desta combinação..." 
                                    value={filterSearch}
                                    onChange={e => setFilterSearch(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-yellow-500/50"
                                />
                            </div>
                        </div>

                        {/* Ninja Cards List */}
                        <div className="p-4 overflow-y-auto overscroll-contain flex-1 scrollbar-thin">
                            {filteredList.length === 0 ? (
                                <div className="py-12 text-center text-slate-500">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{t.no_players_found_combo}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredList.map(ninja => {
                                        const pvpRankData = rankingsMap ? rankingsMap[ninja.Name?.toLowerCase()] : null;
                                        return (
                                            <div 
                                                key={ninja.Name} 
                                                onClick={() => { onClose(); if (onSelectNinja) onSelectNinja(ninja); }}
                                                className="p-3.5 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex items-start gap-3 group shadow-sm"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-300 group-hover:border-yellow-500/50 group-hover:text-yellow-400 transition-colors flex-shrink-0">
                                                    {ninja.Name ? ninja.Name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <h4 className="font-bold text-slate-200 text-sm truncate group-hover:text-yellow-400 transition-colors">
                                                            {ninja.Name}
                                                        </h4>
                                                        <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                                            Lv. {ninja.Level || 0}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                        <VillageBadge village={ninja.ParsedVillage} size="xs" />
                                                        {ninja.ParsedClan && ninja.ParsedClan !== 'Clanless' && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                                                🧬 {ninja.ParsedClan}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                        {ninja.ParsedMasteries && ninja.ParsedMasteries.map((m, idx) => (
                                                            <MasteryBadge key={idx} mastery={m} size="xs" />
                                                        ))}
                                                        {ninja.EquippedWeapon && ninja.EquippedWeapon !== 'None' && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-yellow-300 border border-slate-800" title="Arma equipada">
                                                                🗡️ {ninja.EquippedWeapon}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {pvpRankData && (
                                                        <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-400">
                                                            <span className="text-yellow-500 font-bold flex items-center gap-1">
                                                                <Trophy className="w-2.5 h-2.5" /> {pvpRankData.tournamentWins} T.
                                                            </span>
                                                            <span className="text-slate-300">
                                                                {pvpRankData.wins}V - {pvpRankData.losses}D ({pvpRankData.winRate}% WR)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        const PvPRepresentativesModal = ({ pvpItem, onClose, onSelectPlayer, onSelectNinja, t }) => {
            useLockBodyScroll();
            const [filterSearch, setFilterSearch] = React.useState('');
            if (!pvpItem) return null;

            const { m1, m2, isSingle, advName, name, winRate, wins, losses, battles, tournamentWins, players } = pvpItem;

            const filteredList = (players || []).filter(({ player, ninja }) => {
                if (!filterSearch) return true;
                const searchLower = filterSearch.toLowerCase();
                const pName = (player?.name || '').toLowerCase();
                const nName = (ninja?.Name || '').toLowerCase();
                const village = (ninja?.ParsedVillage || '').toLowerCase();
                const clan = (ninja?.ParsedClan || '').toLowerCase();
                return pName.includes(searchLower) || nName.includes(searchLower) || village.includes(searchLower) || clan.includes(searchLower);
            });

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overscroll-contain animate-in fade-in duration-200" onClick={onClose}>
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] overscroll-contain animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
                                    <Swords className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-black text-white">
                                            {advName ? advName : m1 && m2 ? (isSingle ? `Jogadores de Apenas ${m1}` : `Combinação: ${m1} + ${m2}`) : (name || 'Maestria')}
                                        </h3>
                                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold font-mono">
                                            {players.length} {players.length === 1 ? 'jogador' : 'jogadores'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {advName ? (
                                            <MasteryBadge mastery={advName} size="xs" />
                                        ) : m1 && m2 ? (
                                            <>
                                                <MasteryBadge mastery={m1} size="xs" />
                                                {!isSingle && <span className="text-slate-500 text-xs font-bold">+</span>}
                                                {!isSingle && <MasteryBadge mastery={m2} size="xs" />}
                                            </>
                                        ) : name ? (
                                            <MasteryBadge mastery={name} size="xs" />
                                        ) : null}
                                        <span className="text-slate-600">•</span>
                                        <span className="text-xs font-bold text-green-400">{winRate}% WR</span>
                                        <span className="text-slate-600">•</span>
                                        <span className="text-xs text-slate-400">{wins}V / {losses}D ({battles} jogos)</span>
                                        {tournamentWins > 0 && (
                                            <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3" /> {tournamentWins}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text" 
                                    placeholder="Filtrar jogadores por nome, vila ou clã..." 
                                    value={filterSearch}
                                    onChange={e => setFilterSearch(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-yellow-500/50"
                                />
                            </div>
                        </div>

                        {/* Player Cards List */}
                        <div className="p-4 overflow-y-auto overscroll-contain flex-1 scrollbar-thin">
                            {filteredList.length === 0 ? (
                                <div className="py-12 text-center text-slate-500">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Nenhum jogador encontrado para este filtro.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredList.map(({ player, ninja }, pIdx) => {
                                        const pBattles = player.battles || 0;
                                        const pWR = player.winRate || (pBattles > 0 ? ((player.wins / pBattles) * 100).toFixed(1) : '0.0');
                                        const wrNum = parseFloat(pWR);
                                        const wrColor = wrNum >= 60 ? 'bg-green-500/20 text-green-400 border-green-500/30' : wrNum >= 45 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';

                                        return (
                                            <div 
                                                key={pIdx} 
                                                onClick={() => { onClose(); if (onSelectPlayer) onSelectPlayer(player); }}
                                                className="p-3.5 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex items-start gap-3 group shadow-sm"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-300 group-hover:border-yellow-500/50 group-hover:text-yellow-400 transition-colors flex-shrink-0">
                                                    {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <h4 className="font-bold text-slate-200 text-sm truncate group-hover:text-yellow-400 transition-colors">
                                                            {player.name}
                                                        </h4>
                                                        {ninja && ninja.Level && (
                                                            <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                                                Lv. {ninja.Level}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {ninja && (
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                            {ninja.ParsedVillage && <VillageBadge village={ninja.ParsedVillage} size="xs" />}
                                                            {ninja.ParsedClan && ninja.ParsedClan !== 'Clanless' && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                                                    🧬 {ninja.ParsedClan}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {ninja && ninja.ParsedMasteries && (
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                            {ninja.ParsedMasteries.map((m, mIdx) => (
                                                                <MasteryBadge key={mIdx} mastery={m} size="xs" />
                                                            ))}
                                                            {ninja.EquippedWeapon && ninja.EquippedWeapon !== 'None' && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-yellow-300 border border-slate-800" title="Arma equipada">
                                                                    🗡️ {ninja.EquippedWeapon}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono text-slate-400">
                                                        <span className="text-yellow-500 font-bold flex items-center gap-1">
                                                            <Trophy className="w-3 h-3" /> {(player.tournamentWins || 0)} T.
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-300 font-bold">
                                                                {player.wins}V - {player.losses}D
                                                            </span>
                                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${wrColor}`}>
                                                                {pWR}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        const MasteryAnalyticsView = ({ 
            bingoData, 
            rankings, 
            t, 
            onSelectPlayer, 
            onSelectNinja,
            activeTab,
            setActiveTab,
            timeFilter,
            setTimeFilter,
            availableMonths,
            targetMonth,
            setTargetMonth,
            customStartDate,
            setCustomStartDate,
            customEndDate,
            setCustomEndDate,
            modeGroups,
            language
        }) => {
            const [selectedCombo, setSelectedCombo] = React.useState(null);
            const [selectedPvPItem, setSelectedPvPItem] = React.useState(null);
            const [popTab, setPopTab] = React.useState('single'); // 'single' | 'sub' | 'combo' | 'advanced'
            const [pvpTab, setPvpTab] = React.useState('single'); // 'single' | 'sub' | 'combo' | 'advanced'
            const [pvpSort, setPvpSort] = React.useState('wins'); // 'wins' | 'wr' | 'twins' | 'battles'
            const [onlyHighWR, setOnlyHighWR] = React.useState(false); // toggle: false (general) | true (> 50% WR)

            // Fast lookup for PvP rankings
            const rankingsMap = React.useMemo(() => {
                const map = {};
                if (Array.isArray(rankings)) {
                    rankings.forEach(p => {
                        if (p && p.name) map[p.name.toLowerCase()] = p;
                    });
                }
                return map;
            }, [rankings]);

            const validNinjas = React.useMemo(() => {
                if (!Array.isArray(bingoData)) return [];
                return bingoData.filter(n => n && n.Name && Array.isArray(n.ParsedMasteries));
            }, [bingoData]);

            // Helper to get clean masteries list preserving variants
            const getNinjaMasteries = React.useCallback((ninja) => {
                if (!ninja || !Array.isArray(ninja.ParsedMasteries)) return [];
                
                const v = ninja.ParsedVillage || '';
                const isLeaf = v.includes('Leaf');
                const isSand = v.includes('Sand');
                const isMist = v.includes('Mist');
                
                const eqW = (ninja.EquippedWeapon || '').toLowerCase();
                const isUnarmed = (!ninja.EquippedWeapon || ninja.EquippedWeapon === 'None' || ninja.EquippedWeaponId === 0);
                const isFan = eqW.includes('fan') || eqW.includes('seji no hani');
                const isPipe = eqW.includes('pipe') || eqW.includes('chino awa');
                
                const pm = ninja.ParsedMasteries;
                let hasGF = pm.some(m => m.includes('(Gentle Fist)'));
                let hasBubble = pm.some(m => m.includes('(Bubble)'));
                let hasFan = pm.some(m => m.includes('(Fan)'));
                let hasWMStr = pm.some(m => m.includes('Weapon (STR)'));

                if (!hasBubble && isMist && isPipe && pm.some(m => m.includes('Water'))) {
                    hasBubble = true;
                }
                if (!hasFan && isSand && isFan && pm.some(m => m.includes('Wind'))) {
                    hasFan = true;
                }
                if (!hasGF && isLeaf && (isUnarmed || hasWMStr) && pm.some(m => m.includes('Taijutsu'))) {
                    hasGF = true;
                }

                if (hasGF || hasBubble || hasFan) {
                    hasWMStr = true;
                }

                return Array.from(new Set(
                    pm.map(m => {
                        let clean = m.replace(/^Advanced\s+/i, '').trim();
                        if (clean.startsWith('Water')) {
                            return (hasBubble || clean.includes('(Bubble)')) ? 'Water (Bubble)' : 'Water';
                        }
                        if (clean.startsWith('Wind')) {
                            return (hasFan || clean.includes('(Fan)')) ? 'Wind (Fan)' : 'Wind';
                        }
                        if (clean.startsWith('Taijutsu')) {
                            return (hasGF || clean.includes('(Gentle Fist)')) ? 'Taijutsu (Gentle Fist)' : 'Taijutsu';
                        }
                        if (clean.startsWith('Weapon')) {
                            return (hasWMStr || clean.includes('(STR)')) ? 'Weapon (STR)' : 'Weapon (INT)';
                        }
                        return clean;
                    }).filter(Boolean)
                ));
            }, []);

            const getNinjaBaseMasteries = getNinjaMasteries;
            const getNinjaSpecificMasteries = getNinjaMasteries;

            // Helper: Single mastery only (has ONLY this element, no 2nd mastery)
            const getSingleMasteryNinjas = React.useCallback((m) => {
                return validNinjas.filter(n => {
                    const ms = getNinjaMasteries(n);
                    return ms.length === 1 && ms[0] === m;
                });
            }, [validNinjas, getNinjaMasteries]);

            // Helper: Dual combo (has both m1 and m2)
            const getDualComboNinjas = React.useCallback((m1, m2) => {
                return validNinjas.filter(n => {
                    const ms = getNinjaMasteries(n);
                    return ms.includes(m1) && ms.includes(m2);
                });
            }, [validNinjas, getNinjaMasteries]);

            // Matrix Data & Heatmap Calculation (Triangular Half-Matrix for all 12 masteries)
            const matrixStats = React.useMemo(() => {
                let maxCount = 1;
                const gridData = {};

                ALL_MASTERIES.forEach((row, rIdx) => {
                    ALL_MASTERIES.forEach((col, cIdx) => {
                        if (cIdx >= rIdx) {
                            const isSingle = rIdx === cIdx;
                            const mutuallyExclusive = isMutuallyExclusive(row.name, col.name);
                            const ninjas = mutuallyExclusive ? [] : (isSingle ? getSingleMasteryNinjas(row.name) : getDualComboNinjas(row.name, col.name));
                            if (ninjas.length > maxCount) maxCount = ninjas.length;
                            gridData[`${row.name}_${col.name}`] = {
                                rIdx,
                                cIdx,
                                m1: row.name,
                                m2: col.name,
                                isSingle,
                                mutuallyExclusive,
                                ninjas,
                                count: ninjas.length
                            };
                        }
                    });
                });

                return { gridData, maxCount };
            }, [validNinjas, getSingleMasteryNinjas, getDualComboNinjas]);

            // Heatmap color generator
            const getHeatStyle = (count, max) => {
                if (count === 0) {
                    return {
                        cellBg: 'bg-slate-950/30 border-slate-800/40 text-slate-700',
                        badgeBg: 'text-slate-700 font-medium',
                        labelColor: 'text-slate-700',
                        clickable: false
                    };
                }
                const ratio = count / max;
                if (ratio <= 0.20) {
                    return {
                        cellBg: 'bg-blue-950/40 hover:bg-blue-900/60 border-blue-800/50 text-blue-200 cursor-pointer shadow-sm',
                        badgeBg: 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold',
                        labelColor: 'text-blue-400/80',
                        clickable: true
                    };
                } else if (ratio <= 0.45) {
                    return {
                        cellBg: 'bg-teal-950/50 hover:bg-teal-900/60 border-teal-700/60 text-teal-200 cursor-pointer shadow-sm',
                        badgeBg: 'bg-teal-500/20 text-teal-300 border border-teal-500/50 font-bold',
                        labelColor: 'text-teal-400/80',
                        clickable: true
                    };
                } else if (ratio <= 0.70) {
                    return {
                        cellBg: 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-600/60 text-amber-200 cursor-pointer shadow-md shadow-amber-950/40',
                        badgeBg: 'bg-amber-500/25 text-amber-300 border border-amber-500/60 font-black',
                        labelColor: 'text-amber-400',
                        clickable: true
                    };
                } else if (ratio <= 0.90) {
                    return {
                        cellBg: 'bg-orange-950/75 hover:bg-orange-900/80 border-orange-500/80 text-orange-100 cursor-pointer shadow-lg shadow-orange-950/60',
                        badgeBg: 'bg-orange-500/30 text-orange-200 border border-orange-400 font-black',
                        labelColor: 'text-orange-300',
                        clickable: true
                    };
                } else {
                    return {
                        cellBg: 'bg-red-950/90 hover:bg-red-900/90 border-red-500 text-white cursor-pointer shadow-xl shadow-red-600/30 font-black animate-pulse',
                        badgeBg: 'bg-red-500 text-white font-black shadow-md shadow-red-500/50',
                        labelColor: 'text-red-200',
                        clickable: true
                    };
                }
            };

            // 1. Popularity: Masteries Presence (all 12 masteries)
            const singleMasteryStats = React.useMemo(() => {
                const stats = {};
                ALL_MASTERIES.forEach(m => {
                    stats[m.name] = { ...m, count: 0, ninjas: [] };
                });

                validNinjas.forEach(n => {
                    const ms = getNinjaMasteries(n);
                    ms.forEach(b => {
                        if (stats[b]) {
                            stats[b].count++;
                            stats[b].ninjas.push(n);
                        }
                    });
                });

                return Object.values(stats).sort((a, b) => b.count - a.count);
            }, [validNinjas, getNinjaMasteries]);

            const subMasteryStats = singleMasteryStats.filter(s => s.name.includes('('));

            // 2. Popularity: Normalized Combinations
            const comboMasteryStats = React.useMemo(() => {
                const map = {};
                validNinjas.forEach(ninja => {
                    const ms = getNinjaMasteries(ninja);
                    if (ms.length === 0) return;

                    let key = '';
                    let m1 = '', m2 = '', isSingle = false;
                    if (ms.length === 1) {
                        m1 = ms[0];
                        m2 = ms[0];
                        isSingle = true;
                        key = `Apenas ${ms[0]}`;
                    } else {
                        const sorted = [...ms].slice(0, 2).sort();
                        m1 = sorted[0];
                        m2 = sorted[1];
                        isSingle = false;
                        key = `${sorted[0]} + ${sorted[1]}`;
                    }

                    if (!map[key]) {
                        map[key] = { key, m1, m2, isSingle, count: 0, ninjas: [] };
                    }
                    map[key].count++;
                    map[key].ninjas.push(ninja);
                });

                return Object.values(map).sort((a, b) => b.count - a.count);
            }, [validNinjas, getNinjaMasteries]);

            // 3. Popularity: Advanced Masteries
            const advancedMasteryStats = React.useMemo(() => {
                const stats = {};
                ALL_MASTERIES.forEach(m => {
                    const advName = `Advanced ${m.name}`;
                    stats[advName] = { baseName: m.name, advName, icon: m.icon, count: 0, ninjas: [] };
                });

                validNinjas.forEach(n => {
                    const ms = getNinjaMasteries(n);
                    (n.ParsedMasteries || []).forEach(rawM => {
                        if (!rawM.startsWith('Advanced ')) return;
                        let targetAdv = null;
                        if (rawM.includes('Water')) targetAdv = ms.includes('Water (Bubble)') ? 'Advanced Water (Bubble)' : 'Advanced Water';
                        else if (rawM.includes('Wind')) targetAdv = ms.includes('Wind (Fan)') ? 'Advanced Wind (Fan)' : 'Advanced Wind';
                        else if (rawM.includes('Taijutsu')) targetAdv = ms.includes('Taijutsu (Gentle Fist)') ? 'Advanced Taijutsu (Gentle Fist)' : 'Advanced Taijutsu';
                        else if (rawM.includes('Weapon')) targetAdv = ms.includes('Weapon (STR)') ? 'Advanced Weapon (STR)' : 'Advanced Weapon (INT)';
                        else {
                            const clean = rawM.replace(/^Advanced\s+/i, '').trim();
                            targetAdv = `Advanced ${clean}`;
                        }

                        if (targetAdv && stats[targetAdv]) {
                            stats[targetAdv].count++;
                            stats[targetAdv].ninjas.push(n);
                        }
                    });
                });

                return Object.values(stats).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
            }, [validNinjas, getNinjaMasteries]);

            // 4. PvP Efficiency Stats
            const pvpAnalytics = React.useMemo(() => {
                const singleMap = {};
                const comboMap = {};
                const advMap = {};

                ALL_MASTERIES.forEach(m => {
                    singleMap[m.name] = { name: m.name, labelPt: m.labelPt, icon: m.icon, wins: 0, losses: 0, battles: 0, tournamentWins: 0, players: [] };
                });

                if (Array.isArray(rankings)) {
                    rankings.forEach(player => {
                        const ninja = validNinjas.find(n => n.Name.toLowerCase() === player.name.toLowerCase());
                        if (!ninja || !Array.isArray(ninja.ParsedMasteries) || ninja.ParsedMasteries.length === 0) return;

                        const battles = player.battles || 0;
                        if (battles === 0) return;

                        if (onlyHighWR) {
                            const pWinRate = (player.wins / battles) * 100;
                            if (pWinRate <= 50) return;
                        }

                        const ms = getNinjaMasteries(ninja);
                        const wins = player.wins || 0;
                        const losses = player.losses || 0;
                        const tWins = player.tournamentWins || 0;

                        // Masteries presence (all 12 masteries)
                        ms.forEach(mName => {
                            if (singleMap[mName]) {
                                singleMap[mName].wins += wins;
                                singleMap[mName].losses += losses;
                                singleMap[mName].battles += battles;
                                singleMap[mName].tournamentWins += tWins;
                                singleMap[mName].players.push({ player, ninja });
                            }
                        });

                        // Combinations (using specific masteries to capture Fan, Bubble, GF, etc.)
                        let comboKey = '';
                        let m1 = '', m2 = '', isSingle = false;
                        if (ms.length === 1) {
                            m1 = ms[0];
                            m2 = ms[0];
                            isSingle = true;
                            comboKey = `Apenas ${ms[0]}`;
                        } else if (ms.length >= 2) {
                            const sorted = [...ms].slice(0, 2).sort();
                            m1 = sorted[0];
                            m2 = sorted[1];
                            isSingle = false;
                            comboKey = `${sorted[0]} + ${sorted[1]}`;
                        }

                        if (comboKey) {
                            if (!comboMap[comboKey]) {
                                comboMap[comboKey] = { key: comboKey, m1, m2, isSingle, wins: 0, losses: 0, battles: 0, tournamentWins: 0, players: [] };
                            }
                            comboMap[comboKey].wins += wins;
                            comboMap[comboKey].losses += losses;
                            comboMap[comboKey].battles += battles;
                            comboMap[comboKey].tournamentWins += tWins;
                            comboMap[comboKey].players.push({ player, ninja });
                        }

                        // Advanced
                        ninja.ParsedMasteries.forEach(m => {
                            let cleanAdv = m;
                            if (m === 'Advanced Weapon') cleanAdv = 'Advanced Weapon (STR)';
                            if (cleanAdv.startsWith('Advanced ')) {
                                if (!advMap[cleanAdv]) {
                                    advMap[cleanAdv] = { advName: cleanAdv, wins: 0, losses: 0, battles: 0, tournamentWins: 0, players: [] };
                                }
                                advMap[cleanAdv].wins += wins;
                                advMap[cleanAdv].losses += losses;
                                advMap[cleanAdv].battles += battles;
                                advMap[cleanAdv].tournamentWins += tWins;
                                advMap[cleanAdv].players.push({ player, ninja });
                            }
                        });
                    });
                }

                const computeWR = (list) => list.map(item => {
                    const wr = item.battles > 0 ? ((item.wins / item.battles) * 100).toFixed(1) : '0.0';
                    return { ...item, winRate: wr };
                });

                return {
                    single: computeWR(Object.values(singleMap).filter(s => s.battles > 0)),
                    combo: computeWR(Object.values(comboMap).filter(s => s.battles > 0)),
                    advanced: computeWR(Object.values(advMap).filter(s => s.battles > 0))
                };
            }, [rankings, validNinjas, getNinjaMasteries, onlyHighWR]);

            // Sort helper for PvP
            const sortPvPList = (list) => {
                return [...list].sort((a, b) => {
                    if (pvpSort === 'wr') return parseFloat(b.winRate) - parseFloat(a.winRate);
                    if (pvpSort === 'twins') return b.tournamentWins - a.tournamentWins;
                    if (pvpSort === 'battles') return b.battles - a.battles;
                    return b.wins - a.wins;
                });
            };

            const activePvPList = sortPvPList(pvpAnalytics[pvpTab] || []);

            return (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Header Banner */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                    <BarChart3 className="w-6 h-6 text-yellow-500" />
                                    {t.mastery_analytics_title}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    {t.mastery_analytics_desc}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Ninjas no Censo</span>
                                    <span className="text-lg font-black text-yellow-400">{validNinjas.length}</span>
                                </div>
                                <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Combinações Ativas</span>
                                    <span className="text-lg font-black text-blue-400">{comboMasteryStats.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 1: PVP & TOURNAMENT PERFORMANCE RANKINGS */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Swords className="w-5 h-5 text-yellow-500" />
                                    {t.pvp_tab}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {onlyHighWR 
                                        ? 'Exibindo dados apenas de jogadores com Win Rate acima de 50% (WR > 50%).' 
                                        : 'Desempenho geral baseado em todos os jogadores registrados no Ranking.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* WR 50%+ Toggle Switch */}
                                <button 
                                    onClick={() => setOnlyHighWR(!onlyHighWR)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer select-none ${
                                        onlyHighWR 
                                            ? 'bg-green-500/20 text-green-300 border-green-500/50 shadow-md shadow-green-500/10' 
                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                                    }`}
                                    title="Filtrar dados para considerar apenas jogadores com mais de 50% de vitórias"
                                >
                                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${onlyHighWR ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-slate-600'}`} />
                                    <span>Apenas WR &gt; 50%</span>
                                </button>

                                {/* Type Toggle */}
                                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                    <button onClick={() => setPvpTab('single')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${pvpTab === 'single' ? 'bg-yellow-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>{t.view_single_masteries}</button>
                                    <button onClick={() => setPvpTab('combo')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${pvpTab === 'combo' ? 'bg-yellow-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>{t.view_combinations}</button>
                                    <button onClick={() => setPvpTab('advanced')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${pvpTab === 'advanced' ? 'bg-yellow-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>{t.view_advanced}</button>
                                </div>
                                {/* Sort Dropdown */}
                                <select 
                                    value={pvpSort} 
                                    onChange={e => setPvpSort(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500/50 cursor-pointer"
                                >
                                    <option value="wins">{t.sort_wins}</option>
                                    <option value="wr">{t.sort_wr}</option>
                                    <option value="twins">{t.sort_twins}</option>
                                    <option value="battles">{t.sort_battles}</option>
                                </select>
                            </div>
                        </div>

                        {/* PVP FILTER TOOLBAR (Modes & Period) */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
                            {/* Left: Game Mode Buttons */}
                            {modeGroups && modeGroups.main && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {modeGroups.main.map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setActiveTab && setActiveTab(mode)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                                                activeTab === mode 
                                                    ? 'bg-blue-600 text-white shadow-md' 
                                                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            {mode === 'Geral' ? <Filter className="w-3 h-3" /> : mode === 'Ranked' ? <ShieldCheck className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
                                            {mode === 'Geral' && language === 'en' ? 'General' : mode}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Right: Period & Date Filter */}
                            <div className="flex flex-wrap items-center gap-2">
                                {timeFilter === 'custom' && (
                                    <div className="flex items-center gap-1.5">
                                        <input 
                                            type="date" 
                                            value={customStartDate || ''} 
                                            onChange={e => setCustomStartDate && setCustomStartDate(e.target.value)} 
                                            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                                        />
                                        <span className="text-slate-500 text-xs font-bold">~</span>
                                        <input 
                                            type="date" 
                                            value={customEndDate || ''} 
                                            onChange={e => setCustomEndDate && setCustomEndDate(e.target.value)} 
                                            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                                        />
                                    </div>
                                )}

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    </div>
                                    <select 
                                        value={timeFilter || 'current_month'} 
                                        onChange={(e) => setTimeFilter && setTimeFilter(e.target.value)} 
                                        className="appearance-none bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-1.5 pl-8 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer hover:bg-slate-800 transition-colors"
                                    >
                                        <option value="current_month">{t.current_month}</option>
                                        <option value="day">{t.day}</option>
                                        <option value="week">{t.week}</option>
                                        <option value="specific_month">{t.specific_month}</option>
                                        <option value="custom">{t.custom_date}</option>
                                        <option value="all">{t.all}</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                        <ChevronDown className="w-3 h-3 text-slate-500" />
                                    </div>
                                </div>

                                {timeFilter === 'specific_month' && availableMonths && availableMonths.length > 0 && (
                                    <div className="relative group">
                                        <select 
                                            value={targetMonth || ''} 
                                            onChange={(e) => setTargetMonth && setTargetMonth(e.target.value)} 
                                            className="appearance-none bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-1.5 px-3 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                                        >
                                            {availableMonths.map(period => (
                                                <option key={period.id} value={period.id}>{period.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                            <ChevronDown className="w-3 h-3 text-slate-500" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PvP Table */}
                        {activePvPList.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                <Swords className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Nenhum dado de PvP registrado para esta seleção ainda.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto scrollbar-thin">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="p-3.5 text-center">#</th>
                                            <th className="p-3.5">Maestria / Combinação</th>
                                            <th className="p-3.5 text-center">Win Rate</th>
                                            <th className="p-3.5 text-center">Vitórias</th>
                                            <th className="p-3.5 text-center">Derrotas</th>
                                            <th className="p-3.5 text-center">Partidas</th>
                                            <th className="p-3.5 text-center">Torneios</th>
                                            <th className="p-3.5">Top Representantes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {activePvPList.map((item, idx) => {
                                            const wr = parseFloat(item.winRate);
                                            const wrColor = wr >= 60 ? 'bg-green-500/20 text-green-400 border-green-500/30' : wr >= 45 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';

                                            return (
                                                <tr 
                                                    key={idx} 
                                                    onClick={() => setSelectedPvPItem(item)}
                                                    className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                                    title="Clique para ver todos os jogadores desta combinação"
                                                >
                                                    <td className="p-3.5 text-center font-bold text-slate-500 font-mono text-sm">
                                                        #{idx + 1}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {item.advName ? (
                                                                <MasteryBadge mastery={item.advName} size="xs" />
                                                            ) : item.m1 && item.m2 ? (
                                                                <>
                                                                    <MasteryBadge mastery={item.m1} size="xs" />
                                                                    {!item.isSingle && <span className="text-slate-500 text-xs font-bold">+</span>}
                                                                    {!item.isSingle && <MasteryBadge mastery={item.m2} size="xs" />}
                                                                    {item.isSingle && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Apenas</span>}
                                                                </>
                                                            ) : (
                                                                <MasteryBadge mastery={item.name} size="xs" />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${wrColor}`}>
                                                            {item.winRate}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-center font-bold text-slate-200 text-sm">
                                                        {item.wins}
                                                    </td>
                                                    <td className="p-3.5 text-center font-medium text-slate-500 text-sm">
                                                        {item.losses}
                                                    </td>
                                                    <td className="p-3.5 text-center font-mono text-slate-400 text-xs">
                                                        {item.battles}
                                                    </td>
                                                    <td className="p-3.5 text-center font-bold text-yellow-500 text-sm">
                                                        {item.tournamentWins > 0 ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <Trophy className="w-3.5 h-3.5" /> {item.tournamentWins}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {item.players.slice(0, 4).map(({ player }, pIdx) => (
                                                                <span 
                                                                    key={pIdx} 
                                                                    onClick={(e) => { e.stopPropagation(); if (onSelectPlayer) onSelectPlayer(player); }}
                                                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-yellow-400 text-[11px] font-bold cursor-pointer transition-colors border border-slate-700 shadow-sm"
                                                                >
                                                                    {player.name}
                                                                </span>
                                                            ))}
                                                            {item.players.length > 4 && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedPvPItem(item); }}
                                                                    className="px-2 py-0.5 rounded-full bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 text-blue-300 hover:text-white text-[10px] font-black cursor-pointer transition-all hover:scale-105 shadow-sm"
                                                                    title={`Ver todos os ${item.players.length} jogadores`}
                                                                >
                                                                    +{item.players.length - 4} ver todos
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: POPULARITY RANKINGS */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Flame className="w-5 h-5 text-orange-500" />
                                    {t.popularity_tab}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Distribuição percentual das escolhas de maestria no servidor.
                                </p>
                            </div>
                            {/* Toggle Sub-tabs */}
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                <button 
                                    onClick={() => setPopTab('single')} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${popTab === 'single' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {t.view_single_masteries}
                                </button>
                                <button 
                                    onClick={() => setPopTab('combo')} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${popTab === 'combo' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {t.view_combinations}
                                </button>
                                <button 
                                    onClick={() => setPopTab('advanced')} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${popTab === 'advanced' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {t.view_advanced}
                                </button>
                            </div>
                        </div>

                        {/* Popularity Content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {popTab === 'single' && singleMasteryStats.map((item, idx) => {
                                const percent = validNinjas.length > 0 ? ((item.count / validNinjas.length) * 100).toFixed(1) : '0';
                                return (
                                    <div 
                                        key={item.name} 
                                        onClick={() => setSelectedCombo({ m1: item.name, m2: item.name, isSingle: true, isPresence: true, ninjas: item.ninjas })}
                                        className="p-4 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-slate-500 text-sm">#{idx + 1}</span>
                                                <MasteryBadge mastery={item.name} size="sm" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-white">{item.count}</span>
                                                <span className="text-xs font-bold text-slate-400 font-mono">({percent}%)</span>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                            <div className="bg-gradient-to-r from-blue-500 to-yellow-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}

                            {popTab === 'combo' && comboMasteryStats.map((item, idx) => {
                                const percent = validNinjas.length > 0 ? ((item.count / validNinjas.length) * 100).toFixed(1) : '0';
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedCombo({ m1: item.m1, m2: item.m2, isSingle: item.isSingle, ninjas: item.ninjas })}
                                        className="p-4 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-500 text-sm">#{idx + 1}</span>
                                                <MasteryBadge mastery={item.m1} size="xs" />
                                                {!item.isSingle && <span className="text-slate-500 text-xs font-bold">+</span>}
                                                {!item.isSingle && <MasteryBadge mastery={item.m2} size="xs" />}
                                                {item.isSingle && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Apenas</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-white">{item.count}</span>
                                                <span className="text-xs font-bold text-slate-400 font-mono">({percent}%)</span>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                            <div className="bg-gradient-to-r from-blue-500 to-yellow-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}

                            {popTab === 'advanced' && advancedMasteryStats.map((item, idx) => {
                                const percent = validNinjas.length > 0 ? ((item.count / validNinjas.length) * 100).toFixed(1) : '0';
                                return (
                                    <div 
                                        key={item.advName} 
                                        onClick={() => setSelectedCombo({ m1: item.baseName, m2: item.baseName, isSingle: true, ninjas: item.ninjas })}
                                        className="p-4 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-slate-500 text-sm">#{idx + 1}</span>
                                                <MasteryBadge mastery={item.advName} size="sm" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-amber-400">{item.count}</span>
                                                <span className="text-xs font-bold text-slate-400 font-mono">({percent}%)</span>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                            <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION 3: THE DUAL-MASTERY MATRIX / QUADRANT (HEATMAP & NON-REPEATING HALF-MATRIX) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <GridIcon className="w-5 h-5 text-yellow-500" />
                                    {t.matrix_title}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {t.matrix_subtitle}
                                </p>
                            </div>
                        </div>

                        {/* Interactive Half-Matrix Grid */}
                        <div className="overflow-x-auto pb-4 scrollbar-thin">
                            <table className="min-w-[700px] w-full border-collapse select-none">
                                <thead>
                                    <tr>
                                        <th className="p-2 w-28 bg-slate-950/80 border border-slate-800 rounded-tl-xl text-center text-xs font-bold text-slate-400">
                                            Maestria
                                        </th>
                                        {ALL_MASTERIES.map(col => (
                                            <th key={col.name} className="p-1.5 border border-slate-800 bg-slate-950/60 text-center min-w-[56px]" title={col.labelPt || col.name}>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <img src={col.icon} alt={col.name} className="w-5 h-5 object-contain inline-block" />
                                                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[52px]">{col.shortPt || col.name}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ALL_MASTERIES.map((row, rIdx) => (
                                        <tr key={row.name}>
                                            {/* Row Header */}
                                            <td className="p-2 border border-slate-800 bg-slate-950/60 whitespace-nowrap min-w-[125px]">
                                                <div className="flex items-center gap-2">
                                                    <img src={row.icon} alt={row.name} className="w-5 h-5 object-contain inline-block" />
                                                    <span className="text-xs font-bold text-slate-200 truncate">{row.labelPt || row.name}</span>
                                                </div>
                                            </td>

                                            {/* Matrix Cells */}
                                            {ALL_MASTERIES.map((col, cIdx) => {
                                                // If lower triangle, don't repeat to eliminate redundancy
                                                if (cIdx < rIdx) {
                                                    return (
                                                        <td 
                                                            key={col.name} 
                                                            className="p-1 border border-slate-900/40 bg-slate-950/20 text-center opacity-10"
                                                        />
                                                    );
                                                }

                                                const cellInfo = matrixStats.gridData[`${row.name}_${col.name}`] || { count: 0, isSingle: rIdx === cIdx, mutuallyExclusive: false, ninjas: [] };
                                                const { count, isSingle, mutuallyExclusive, ninjas: matchingNinjas } = cellInfo;

                                                if (mutuallyExclusive) {
                                                    return (
                                                        <td 
                                                            key={col.name}
                                                            className="p-1 text-center border border-slate-900/60 bg-slate-950/40 select-none cursor-not-allowed"
                                                            title={`${row.labelPt || row.name} e ${col.labelPt || col.name} não combinam entre si (mesma base ou vilas exclusivas diferentes)`}
                                                        >
                                                            <span className="text-slate-700 text-xs font-mono font-bold">✕</span>
                                                        </td>
                                                    );
                                                }

                                                const heat = getHeatStyle(count, matrixStats.maxCount);

                                                return (
                                                    <td 
                                                        key={col.name}
                                                        onClick={() => {
                                                            if (count > 0) {
                                                                setSelectedCombo({
                                                                    m1: row.name,
                                                                    m2: col.name,
                                                                    isSingle,
                                                                    ninjas: matchingNinjas
                                                                });
                                                            }
                                                        }}
                                                        className={`p-1.5 text-center border transition-all ${heat.cellBg}`}
                                                        title={count > 0 ? (isSingle ? `${count} ninjas com apenas ${row.labelPt || row.name}` : `${count} ninjas com ${row.labelPt || row.name} + ${col.labelPt || col.name}`) : 'Nenhum ninja'}
                                                    >
                                                        {count > 0 ? (
                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                <div className="flex items-center gap-0.5">
                                                                    {isSingle ? (
                                                                        <img src={row.icon} alt={row.name} className="w-3.5 h-3.5 object-contain inline-block" />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center -space-x-1">
                                                                            <img src={row.icon} alt={row.name} className="w-3 h-3 object-contain" />
                                                                            <img src={col.icon} alt={col.name} className="w-3 h-3 object-contain" />
                                                                        </div>
                                                                    )}
                                                                    <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono transition-transform hover:scale-110 ${heat.badgeBg}`}>
                                                                        {count}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[8px] font-bold ${heat.labelColor}`}>
                                                                    {isSingle ? 'Apenas' : 'Dupla'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-700 text-xs font-mono">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Heatmap Legend */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-300">🔥 Mapa de Calor:</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950/60 border border-blue-800 text-blue-300 font-bold">Frio (Poucos)</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-teal-950/60 border border-teal-700 text-teal-300 font-bold">Médio</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-600 text-amber-300 font-bold">Morno</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-orange-950/75 border border-orange-500 text-orange-200 font-bold">Quente</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/90 border border-red-500 text-red-200 font-black">Pico (Mais Ninjas)</span>
                                </div>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-3 flex-wrap">
                                <span>* Apenas = ninja tem apenas 1 maestria. Dupla = combinação de 2 maestrias.</span>
                                <span className="text-slate-400 font-bold">✕ = Incompatível (mesma base ou vilas exclusivas diferentes).</span>
                            </div>
                        </div>
                    </div>

                    {/* Modal for viewing ninjas of a selected combination */}
                    {selectedCombo && (
                        <MasteryComboModal 
                            comboData={selectedCombo}
                            onClose={() => setSelectedCombo(null)}
                            onSelectNinja={onSelectNinja}
                            t={t}
                            rankingsMap={rankingsMap}
                        />
                    )}

                    {/* Modal for viewing all PvP representatives */}
                    {selectedPvPItem && (
                        <PvPRepresentativesModal 
                            pvpItem={selectedPvPItem}
                            onClose={() => setSelectedPvPItem(null)}
                            onSelectPlayer={onSelectPlayer}
                            onSelectNinja={onSelectNinja}
                            t={t}
                        />
                    )}
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
window.MasteryBadge = MasteryBadge;
window.VillageBadge = VillageBadge;
window.NinjaDetailsModal = NinjaDetailsModal;
window.BingoBookView = BingoBookView;
window.MasteryComboModal = MasteryComboModal;
window.PvPRepresentativesModal = PvPRepresentativesModal;
window.MasteryAnalyticsView = MasteryAnalyticsView;

