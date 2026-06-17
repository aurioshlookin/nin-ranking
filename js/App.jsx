        


        const useLockBodyScroll = () => {
            React.useLayoutEffect(() => {
                const originalStyle = window.getComputedStyle(document.body).overflow;
                document.body.style.overflow = 'hidden';
                return () => { document.body.style.overflow = originalStyle; };
            }, []);
        };
        window.useLockBodyScroll = useLockBodyScroll;

        const App = () => {
            const [rawData, setRawData] = useState([]);
            const [mapData, setMapData] = useState([]);
            const [blessData, setBlessData] = useState([]);
            const [data, setData] = useState({ rankings: [], history: {} });
            const [isLoading, setIsLoading] = useState(false);
            const [error, setError] = useState(null);
            
            // --- LANGUAGE STATE ---
            const [language, setLanguage] = useState(() => {
                const browserLang = navigator.language || navigator.userLanguage;
                return (browserLang === 'pt-BR' || browserLang === 'pt') ? 'pt' : 'en';
            });
            const t = TRANSLATIONS[language];

            const [searchTerm, setSearchTerm] = useState('');
            const [sortConfig, setSortConfig] = useState({ key: 'tournamentWins', direction: 'desc' });
            const [activeTab, setActiveTab] = useState('Geral');
            const [selectedPlayer, setSelectedPlayer] = useState(null);
            
            const [currentPage, setCurrentPage] = useState(1);
            const ITEMS_PER_PAGE = 50;

            const [timeFilter, setTimeFilter] = useState('current_month');
            const [availableMonths, setAvailableMonths] = useState([]);
            const [targetMonth, setTargetMonth] = useState('');
            const [targetCalendarMonth, setTargetCalendarMonth] = useState('');
            const [dateRange, setDateRange] = useState({ start: null, end: null });
            
            // Estados para Data Personalizada
            const [customStartDate, setCustomStartDate] = useState('');
            const [customEndDate, setCustomEndDate] = useState('');
            const [showOtherModes, setShowOtherModes] = useState(false);

            const [viewMode, setViewMode] = useState('ranking');
            const [blessTab, setBlessTab] = useState('Geral');
            const [mapTab, setMapTab] = useState('Geral');
            const [selectedTournament, setSelectedTournament] = useState(null);
            const [showInfoModal, setShowInfoModal] = useState(false);
            
            useEffect(() => {
                setCurrentPage(1);
            }, [viewMode, blessTab, mapTab]);
            
            const [versusPlayer1, setVersusPlayer1] = useState('');
            const [versusPlayer2, setVersusPlayer2] = useState('');

            // Estados da nova Aba de Partidas
            const [matchSearchP1, setMatchSearchP1] = useState('');
            const [matchSearchP2, setMatchSearchP2] = useState('');
            const [matchSearchP3, setMatchSearchP3] = useState('');
            const [compRankMode, setCompRankMode] = useState('best');
            
            const [loadedFilesCount, setLoadedFilesCount] = useState(0);

            // Limpa o termo de pesquisa caso a aba não seja "Ranking" e limpa a pesquisa de partidas se não for "Partidas"
            useEffect(() => {
                if (viewMode !== 'ranking') {
                    setSearchTerm('');
                }
                if (viewMode !== 'matches') {
                    setMatchSearchP1('');
                    setMatchSearchP2('');
                    setMatchSearchP3('');
                }
            }, [viewMode]);

            const globalPlayerStats = useMemo(() => {
                const stats = {};
                if (!rawData || rawData.length === 0) return stats;
                rawData.forEach(log => {
                    const content = log.content || "";
                    const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (match) {
                        const mode = match[1];
                        const winners = match[2].split(',').map(n => n.trim()).filter(n => n);
                        const losers = match[3].split(',').map(n => n.trim()).filter(n => n);
                        const participants = [...winners, ...losers];
                        participants.forEach(p => {
                            if (!stats[p]) stats[p] = { total: 0, modes: {} };
                            stats[p].total += 1;
                            if (!stats[p].modes[mode]) stats[p].modes[mode] = 0;
                            stats[p].modes[mode] += 1;
                        });
                    }
                });
                return stats;
            }, [rawData]);

            useEffect(() => {
                const favicon = document.getElementById('dynamic-favicon');
                if (favicon && CUSTOM_ICON_URL) favicon.href = CUSTOM_ICON_URL;
            }, []);

            const getRoundedTime = (timestamp) => {
                const date = new Date(timestamp);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes();
                const roundedMinutes = (Math.floor(minutes / 10) * 10).toString().padStart(2, '0');
                return `${hours}:${roundedMinutes}`;
            };

            const getShareLink = (target = null) => {
                const params = new URLSearchParams();
                params.set('view', viewMode);
                params.set('mode', activeTab);
                params.set('time', timeFilter);
                if (targetMonth) params.set('month', targetMonth);

                if (viewMode === 'versus') {
                    if (versusPlayer1) params.set('p1', versusPlayer1);
                    if (versusPlayer2) params.set('p2', versusPlayer2);
                } else if (target && target.name && target.matches) {
                    params.set('tournament', target.id);
                } else if (target && target.name && !target.matches) {
                    params.set('player', target.name);
                }
                return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
            };

            useEffect(() => {
                const parseEntry = (b) => {
                    const dateObj = new Date(b.t || Date.now());
                    const ts = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
                    if (b.m === "SYS_RESET") return { type: 'battle', entry: { content: "vencedores mensais do torneio", timestamp: ts } };
                    if (b.m === "MAP") return { type: 'map', entry: { content: `[Mapa] ${b.w} capturou ${b.l}`, timestamp: ts, footer: b.f } };
                    if (b.m === "BLESS") return { type: 'bless', entry: { content: `[Bênção] ${b.w} abençoou ${b.l}`, timestamp: ts, footer: b.f, type: b.b } };
                    return { type: 'battle', entry: { content: `[${b.m}] ${b.w} derrotou ${b.l}`, timestamp: ts } };
                };

                setIsLoading(true); setError(null);

                const unsubscribe = db.collection('nin_drops_history').onSnapshot(
                    (snapshot) => {
                        const battleLogs = [];
                        const mLogs = [];
                        const bLogs = [];
                        
                        snapshot.docs.forEach(doc => {
                            const data = doc.data();
                            if (data.logs && Array.isArray(data.logs)) {
                                data.logs.forEach(b => {
                                    const { type, entry } = parseEntry(b);
                                    if (type === 'battle') battleLogs.push(entry);
                                    else if (type === 'map') mLogs.push(entry);
                                    else bLogs.push(entry);
                                });
                            }
                        });
                        
                        setLoadedFilesCount(battleLogs.length);
                        setRawData(battleLogs);
                        setMapData(mLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
                        setBlessData(bLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
                        setIsLoading(false);
                    },
                    (err) => {
                        console.error(err);
                        setError(`${t.error_loading}: ${err.message}`);
                        setIsLoading(false);
                    }
                );

                return () => unsubscribe();
            }, []);


            useEffect(() => {
                if (rawData.length === 0) { setData({ rankings: [], history: {} }); return; }
                const timestamps = rawData.map(l => l.timestamp ? new Date(l.timestamp).getTime() : 0).filter(t => t > 0);
                
                if (timestamps.length > 0) {
                    const minTime = Math.min(...timestamps);
                    const maxTime = Math.max(...timestamps);
                    setDateRange({ start: new Date(minTime).toLocaleDateString('pt-BR'), end: new Date(maxTime).toLocaleDateString('pt-BR') });
                    
                    const sortedLogs = [...rawData].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const periods = [];
                    let currentStart = 0;
                    
                    sortedLogs.forEach(log => {
                        let isMonthlyReset = false;
                        const targetPhrase = 'vencedores mensais do torneio';
                        
                        if (JSON.stringify(log).toLowerCase().includes(targetPhrase)) {
                            isMonthlyReset = true;
                        }

                        if (isMonthlyReset) {
                            const endDate = new Date(log.timestamp);
                            
                            const prevMonthDate = new Date(endDate);
                            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
                            
                            const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
                            const year = String(prevMonthDate.getFullYear()).slice(-2); 
                            
                            periods.push({
                                id: `${currentStart}-${endDate.getTime()}`,
                                start: currentStart,
                                end: endDate.getTime(),
                                label: `${month}/${year}`
                            });
                            currentStart = endDate.getTime();
                        }
                    });
                    
                    if (currentStart > 0) {
                        const now = new Date();
                        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
                        const currentYear = String(now.getFullYear()).slice(-2);
                        periods.push({
                            id: `${currentStart}-current`,
                            start: currentStart,
                            end: Number.MAX_SAFE_INTEGER,
                            label: `${currentMonth}/${currentYear}`
                        });
                    }
                    
                    periods.reverse();
                    setAvailableMonths(periods);
                    if (periods.length > 0 && !targetMonth) {
                        setTargetMonth(periods[0].id);
                    }
                }
            }, [rawData]);

            const referenceDate = useMemo(() => new Date(), []);
            
            const availableCalendarMonths = useMemo(() => {
                const allLogs = [...mapData, ...blessData];
                if (allLogs.length === 0) return [];
                let minT = Infinity;
                let maxT = -Infinity;
                allLogs.forEach(l => {
                    const t = new Date(l.timestamp).getTime();
                    if (t < minT) minT = t;
                    if (t > maxT) maxT = t;
                });
                if (minT === Infinity) return [];
                const minDate = new Date(minT);
                const maxDate = new Date(maxT);
                const periods = [];
                let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                while (cur <= maxDate) {
                    const m = cur.getMonth();
                    const y = cur.getFullYear();
                    const label = new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' }).format(cur);
                    periods.push({ id: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
                    cur.setMonth(cur.getMonth() + 1);
                }
                return periods.reverse();
            }, [mapData, blessData, language]);

            useEffect(() => {
                if (availableCalendarMonths.length > 0 && !targetCalendarMonth) {
                    setTargetCalendarMonth(availableCalendarMonths[0].id);
                }
            }, [availableCalendarMonths, targetCalendarMonth]);

            const filterSpecialByTime = (log) => {
                if (timeFilter === 'all') return true;
                if (!log.timestamp) return false;
                
                const logDate = new Date(log.timestamp);
                const logTime = logDate.getTime();
                
                if (timeFilter === 'current_month') {
                    const now = new Date();
                    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
                }
                if (timeFilter === 'specific_month') {
                    if (!targetCalendarMonth) return true;
                    const [y, m] = targetCalendarMonth.split('-');
                    return logDate.getFullYear() === parseInt(y, 10) && logDate.getMonth() === parseInt(m, 10);
                }
                if (timeFilter === 'custom') {
                    if (!customStartDate || !customEndDate) return true; 
                    const start = new Date(customStartDate + 'T00:00:00').getTime();
                    const end = new Date(customEndDate + 'T23:59:59').getTime();
                    return logTime >= start && logTime <= end;
                }
                
                const diff = referenceDate.getTime() - logTime;
                if (timeFilter === 'day') return diff <= 24 * 60 * 60 * 1000;
                if (timeFilter === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
                return true;
            };

            const filteredMapData = useMemo(() => mapData.filter(filterSpecialByTime), [mapData, timeFilter, targetCalendarMonth, customStartDate, customEndDate, referenceDate]);
            const filteredBlessData = useMemo(() => blessData.filter(filterSpecialByTime), [blessData, timeFilter, targetCalendarMonth, customStartDate, customEndDate, referenceDate]);
            
            const mapStats = useMemo(() => {
                const conquerCount = {};
                const mapConquers = {};
                filteredMapData.forEach(m => {
                    if(!m.content.includes(' capturou ')) return;
                    const village = m.content.split(' capturou ')[0].replace('[Mapa] ', '').trim();
                    const mapName = m.content.split(' capturou ')[1].trim();
                    conquerCount[village] = (conquerCount[village] || 0) + 1;
                    
                    if (!mapConquers[mapName]) mapConquers[mapName] = { total: 0, villages: {} };
                    mapConquers[mapName].total++;
                    mapConquers[mapName].villages[village] = (mapConquers[mapName].villages[village] || 0) + 1;
                });
                const topConquerors = Object.entries(conquerCount).sort((a,b) => b[1] - a[1]);
                const topConqueredMaps = Object.entries(mapConquers).sort((a,b) => b[1].total - a[1].total);

                const ownership = {};
                [...mapData].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(m => {
                    const parts = m.content.split(' capturou ');
                    if(parts.length === 2) {
                        ownership[parts[1].trim()] = parts[0].replace('[Mapa] ', '').trim();
                    }
                });
                const ownCount = {};
                const ownedMapsByVillage = {};
                Object.entries(ownership).forEach(([mapName, village]) => {
                    ownCount[village] = (ownCount[village] || 0) + 1;
                    if (!ownedMapsByVillage[village]) ownedMapsByVillage[village] = [];
                    ownedMapsByVillage[village].push(mapName);
                });
                const currentOwnership = Object.entries(ownCount).sort((a,b) => b[1] - a[1]);
                const currentOwnershipDetailed = Object.entries(ownedMapsByVillage).sort((a,b) => b[1].length - a[1].length);

                return { topConquerors, currentOwnership, totalMaps: Object.keys(ownership).length, topConqueredMaps, currentOwnershipDetailed };
            }, [filteredMapData, mapData]);

            const blessStats = useMemo(() => {
                const givers = {};
                let xpCount = 0;
                let dropCount = 0;
                
                filteredBlessData.forEach(m => {
                    const giver = m.content.split(' abençoou ')[0].replace('[Bênção] ', '').trim();
                    if (!givers[giver]) givers[giver] = { total: 0, xp: 0, drop: 0 };
                    givers[giver].total++;
                    if (m.type === 'XP') { givers[giver].xp++; xpCount++; }
                    else if (m.type === 'Drop') { givers[giver].drop++; dropCount++; }
                });
                
                const topGivers = Object.entries(givers).sort((a,b) => b[1].total - a[1].total);
                
                let maxStreak = 0;
                let maxStreakPerson = '-';
                let currentStreak = 0;
                let currentPerson = null;
                
                [...filteredBlessData].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(m => {
                    const giver = m.content.split(' abençoou ')[0].replace('[Bênção] ', '').trim();
                    if (giver === currentPerson) {
                        currentStreak++;
                    } else {
                        currentPerson = giver;
                        currentStreak = 1;
                    }
                    if (currentStreak > maxStreak) {
                        maxStreak = currentStreak;
                        maxStreakPerson = currentPerson;
                    }
                });

                return { topGivers, maxStreak, maxStreakPerson, xpCount, dropCount };
            }, [filteredBlessData]);

            const filteredLogs = useMemo(() => {
                return rawData.filter(log => {
                    if (timeFilter === 'all') return true;
                    if (!log.timestamp) return false;
                    
                    const logTime = new Date(log.timestamp).getTime();

                    if (timeFilter === 'current_month') {
                        let lastReset = 0;
                        if (availableMonths && availableMonths.length > 0) {
                            lastReset = availableMonths[0].start;
                        }
                        return logTime >= lastReset;
                    }
                    
                    if (timeFilter === 'specific_month') {
                        if (!targetMonth) return true;
                        const [startStr, endStr] = targetMonth.split('-');
                        const start = parseInt(startStr, 10);
                        const end = endStr === 'current' ? Number.MAX_SAFE_INTEGER : parseInt(endStr, 10);
                        return logTime >= start && logTime < end;
                    }

                    if (timeFilter === 'custom') {
                        if (!customStartDate || !customEndDate) return true; 
                        const start = new Date(customStartDate + 'T00:00:00').getTime();
                        const end = new Date(customEndDate + 'T23:59:59').getTime();
                        return logTime >= start && logTime <= end;
                    }

                    const diff = referenceDate.getTime() - logTime;
                    const oneDay = 24 * 60 * 60 * 1000;
                    if (timeFilter === 'day') return diff <= oneDay && diff >= 0;
                    if (timeFilter === 'week') return diff <= 7 * oneDay && diff >= 0;
                    
                    return true;
                });
            }, [rawData, timeFilter, targetMonth, referenceDate, availableMonths, customStartDate, customEndDate]);

            useEffect(() => {
                const processed = processBattleLogs(filteredLogs);
                setData(processed);
                setCurrentPage(1); 
            }, [filteredLogs]);

            const modeGroups = useMemo(() => {
                if (filteredLogs.length === 0) return { main: ['Geral', 'Ranked'], others: [] };
                const modes = new Set();
                filteredLogs.forEach(log => {
                    const match = (log.content || "").match(/^\[(.*?)\]/);
                    if (match) modes.add(match[1]);
                });
                const allFoundModes = Array.from(modes);
                const mainModes = ['Geral', 'Ranked', ...PRIORITY_MODES.filter(m => modes.has(m))];
                const otherModes = allFoundModes.filter(m => !PRIORITY_MODES.includes(m)).sort();
                return { main: mainModes, others: otherModes };
            }, [filteredLogs]);

            const groupedTournaments = useMemo(() => {
                if (filteredLogs.length === 0) return [];
                const sortedLogs = [...filteredLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                const tournaments = [];
                const GAP_THRESHOLD = 90 * 60 * 1000; 
                sortedLogs.forEach(log => {
                    const content = log.content || "";
                    const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (match && log.timestamp) {
                        const mode = match[1];
                        let isMatch = false;
                        if (activeTab === 'Geral') isMatch = true;
                        else if (activeTab === 'Ranked') { if (['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) isMatch = true; } 
                        else if (mode === activeTab) { isMatch = true; }
                        if (!isMatch) return;

                        const logTime = new Date(log.timestamp).getTime();
                        let targetTournament = null;
                        for (let i = tournaments.length - 1; i >= 0; i--) {
                            if (tournaments[i].name === mode) {
                                const lastMatchTime = tournaments[i].lastMatchTimestamp;
                                if (logTime - lastMatchTime <= GAP_THRESHOLD) { targetTournament = tournaments[i]; }
                                break; 
                            }
                        }
                        const winners = match[2].split(',').map(n => n.trim()).filter(n => n.length > 0);
                        const losers = match[3].split(',').map(n => n.trim()).filter(n => n.length > 0);
                        const matchData = { winners, losers, timestamp: log.timestamp };
                        if (targetTournament) { targetTournament.matches.push(matchData); targetTournament.lastMatchTimestamp = logTime; } 
                        else { tournaments.push({ id: `${mode}-${log.timestamp}`, name: mode, date: new Date(log.timestamp).toLocaleDateString('pt-BR'), timestamp: logTime, lastMatchTimestamp: logTime, matches: [matchData] }); }
                    }
                });
                return tournaments.sort((a, b) => b.lastMatchTimestamp - a.lastMatchTimestamp);
            }, [filteredLogs, activeTab]);

            const tournamentStats = useMemo(() => {
                const stats = {};
                groupedTournaments.forEach(t => {
                    const sortedMatches = [...t.matches].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const lastMatch = sortedMatches[sortedMatches.length - 1];
                    const participants = new Set();
                    t.matches.forEach(m => { m.winners.forEach(w => participants.add(w)); m.losers.forEach(l => participants.add(l)); });
                    participants.forEach(p => { if (!stats[p]) stats[p] = { wins: 0, played: 0 }; stats[p].played += 1; });
                    if (lastMatch) { lastMatch.winners.forEach(w => { if (!stats[w]) stats[w] = { wins: 0, played: 0 }; stats[w].wins += 1; }); }
                });
                return stats;
            }, [groupedTournaments]);

            const tournamentsByDate = useMemo(() => {
                const groups = {};
                groupedTournaments.forEach(t => {
                    if (!groups[t.date]) groups[t.date] = [];
                    groups[t.date].push(t);
                });
                return groups;
            }, [groupedTournaments]);

             const filteredRankings = useMemo(() => {
                let players = [...data.rankings];
                if (activeTab === 'Geral') {
                    players = players.map(p => { const tStats = tournamentStats[p.name] || { wins: 0, played: 0 }; return { ...p, tournamentWins: tStats.wins, tournamentsPlayed: tStats.played }; });
                } else if (activeTab === 'Ranked') {
                    players = players.map(p => {
                        let wins = 0, losses = 0, battles = 0;
                        const rankedModes = ['Auto1v1', 'Auto2v2', 'Auto3v3'];
                        rankedModes.forEach(m => { if (p.modes && p.modes[m]) { wins += p.modes[m].wins; losses += p.modes[m].losses; battles += p.modes[m].battles; } });
                        if (battles === 0) return null;
                        const tStats = tournamentStats[p.name] || { wins: 0, played: 0 };
                        return { ...p, wins, losses, battles, winRate: ((wins / battles) * 100).toFixed(1), tournamentWins: tStats.wins, tournamentsPlayed: tStats.played };
                    }).filter(p => p !== null);
                } else {
                    players = players.map(p => {
                        const modeStats = p.modes && p.modes[activeTab];
                        if (!modeStats) return null;
                        const tStats = tournamentStats[p.name] || { wins: 0, played: 0 };
                        return { ...p, wins: modeStats.wins, losses: modeStats.losses, battles: modeStats.battles, winRate: modeStats.battles > 0 ? ((modeStats.wins / modeStats.battles) * 100).toFixed(1) : 0, tournamentWins: tStats.wins, tournamentsPlayed: tStats.played };
                    }).filter(p => p !== null);
                }

                players = players.map(p => {
                    const gStats = globalPlayerStats[p.name];
                    let globalBattles = 0;
                    if (gStats) {
                        if (activeTab === 'Geral') globalBattles = gStats.total;
                        else if (activeTab === 'Ranked') globalBattles = (gStats.modes['Auto1v1'] || 0) + (gStats.modes['Auto2v2'] || 0) + (gStats.modes['Auto3v3'] || 0);
                        else globalBattles = gStats.modes[activeTab] || 0;
                    }
                    const newBadges = [...(p.badges || [])];
                    if (globalBattles >= 1000) newBadges.push({ id: 'master', icon: ShurikenIcon, label: t.icon_master, color: 'text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]' });
                    else if (globalBattles >= 100) newBadges.push({ id: 'veteran', icon: ShurikenIcon, label: t.icon_veteran, color: 'text-blue-400' });
                    
                    // Conquistas Dinâmicas do Filtro Atual
                    const currentWR = parseFloat(p.winRate);
                    if (p.battles >= 10 && currentWR === 100) newBadges.push({ id: 'invincible', icon: ShieldCheck, label: 'Invicto', color: 'text-emerald-400 drop-shadow-[0_0_2px_rgba(52,211,153,0.8)]' });
                    else if (p.battles >= 20 && currentWR < 30) newBadges.push({ id: 'underdog', icon: TrendingDown, label: 'Azarão', color: 'text-purple-400' });
                    if (p.battles >= 50) newBadges.push({ id: 'insomniac', icon: Clock, label: 'Gladiador Insone', color: 'text-pink-400' });

                    // Identifica o streak de acordo com o filtro atual
                    let displayStreak = 0;
                    if (activeTab === 'Geral') displayStreak = p.streak || 0;
                    else if (activeTab === 'Ranked') displayStreak = p.rankedStreak || 0;
                    else displayStreak = p.modes && p.modes[activeTab] ? p.modes[activeTab].streak : 0;

                    return { ...p, displayStreak, badges: newBadges };
                });

                // Ordena todos os jogadores PRIMEIRO
                players.sort((a, b) => {
                    let aValue = a[sortConfig.key] || 0;
                    let bValue = b[sortConfig.key] || 0;
                    
                    if (sortConfig.key === 'winRate' || sortConfig.key === 'wins' || sortConfig.key === 'losses' || sortConfig.key === 'battles' || sortConfig.key === 'tournamentWins' || sortConfig.key === 'tournamentsPlayed') {
                        aValue = parseFloat(aValue);
                        bValue = parseFloat(bValue);
                    }

                    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                    if (sortConfig.key !== 'wins') return b.wins - a.wins;
                    return 0;
                });

                // Assinala a posição real deles no ranking
                players = players.map((p, index) => ({ ...p, realRankPosition: index + 1 }));

                // SÓ ENTÃO aplica a busca
                if (searchTerm) {
                    players = players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
                }

                return players;
            }, [data.rankings, searchTerm, sortConfig, activeTab, globalPlayerStats, tournamentStats, t]);

            const paginatedRankings = useMemo(() => {
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                return filteredRankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            }, [filteredRankings, currentPage]);

            const totalPages = Math.ceil(filteredRankings.length / ITEMS_PER_PAGE);

            const paginatedMaps = useMemo(() => {
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                return filteredMapData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            }, [filteredMapData, currentPage]);
            const totalMapPages = Math.ceil(filteredMapData.length / ITEMS_PER_PAGE);

            const paginatedMapRank = useMemo(() => {
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                return mapStats.topConqueredMaps.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            }, [mapStats.topConqueredMaps, currentPage]);
            const totalMapRankPages = Math.ceil(mapStats.topConqueredMaps.length / ITEMS_PER_PAGE);

            const paginatedBlessings = useMemo(() => {
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                return filteredBlessData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            }, [filteredBlessData, currentPage]);
            const totalBlessPages = Math.ceil(filteredBlessData.length / ITEMS_PER_PAGE);

            const paginatedBlessRank = useMemo(() => {
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                return blessStats.topGivers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            }, [blessStats.topGivers, currentPage]);
            const totalBlessRankPages = Math.ceil(blessStats.topGivers.length / ITEMS_PER_PAGE);

            const handleSort = (key) => {
                let direction = 'desc';
                if (sortConfig.key === key && sortConfig.direction === 'desc') { direction = 'asc'; }
                setSortConfig({ key, direction });
            };

            const handleOpenTournament = (mode, timestamp) => {
                const found = groupedTournaments.find(t => t.name === mode && t.matches.some(m => m.timestamp === timestamp));
                if (found) {
                    setSelectedTournament(found);
                    setSelectedPlayer(null); 
                }
            };

            const handlePlayerClick = (playerName) => {
                if (!data.rankings) return;
                let player = data.rankings.find(r => r.name === playerName);
                if (!player) player = { name: playerName, wins: 0, losses: 0, battles: 0, winRate: 0, badges: [], streak: 0, rankedStreak: 0, modes: {} };
                const gStats = globalPlayerStats[playerName];
                let globalBattles = 0;
                if (gStats) {
                    if (activeTab === 'Geral') globalBattles = gStats.total;
                    else if (activeTab === 'Ranked') globalBattles = (gStats.modes['Auto1v1'] || 0) + (gStats.modes['Auto2v2'] || 0) + (gStats.modes['Auto3v3'] || 0);
                    else globalBattles = gStats.modes[activeTab] || 0;
                }
                const currentBadges = player.badges ? player.badges.filter(b => b.id !== 'veteran' && b.id !== 'master') : [];
                const newBadges = [...currentBadges];
                if (globalBattles >= 1000) newBadges.push({ id: 'master', icon: ShurikenIcon, label: t.icon_master, color: 'text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]' });
                else if (globalBattles >= 100) newBadges.push({ id: 'veteran', icon: ShurikenIcon, label: t.icon_veteran, color: 'text-blue-400' });
                
                // Streak a apresentar no modal
                let displayStreak = 0;
                if (activeTab === 'Geral') displayStreak = player.streak || 0;
                else if (activeTab === 'Ranked') displayStreak = player.rankedStreak || 0;
                else displayStreak = player.modes && player.modes[activeTab] ? player.modes[activeTab].streak : 0;

                setSelectedPlayer({ ...player, badges: newBadges, displayStreak });
                setSelectedTournament(null); 
            };

            const totalBattles = filteredRankings.reduce((acc, curr) => acc + curr.wins, 0); 
            const mostWinsPlayer = useMemo(() => {
                if (filteredRankings.length === 0) return null;
                return [...filteredRankings].sort((a,b) => { if (b.wins !== a.wins) return b.wins - a.wins; return parseFloat(b.winRate) - parseFloat(a.winRate); })[0];
            }, [filteredRankings]);
            const highestStreakPlayer = useMemo(() => {
                if (filteredRankings.length === 0) return null;
                const validPlayers = filteredRankings.filter(p => (p.displayStreak || 0) > 0);
                if (validPlayers.length === 0) return null;
                return validPlayers.sort((a,b) => { 
                    if (b.displayStreak !== a.displayStreak) return b.displayStreak - a.displayStreak; 
                    return b.wins - a.wins; 
                })[0];
            }, [filteredRankings]);

            const versusMatches = useMemo(() => {
                if (!versusPlayer1 || !versusPlayer2 || viewMode !== 'versus') return [];
                return filteredLogs.filter(log => {
                    const content = log.content || "";
                    const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (!match) return false;
                    const mode = match[1];
                    if (activeTab !== 'Geral') {
                        if (activeTab === 'Ranked') { if (!['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) return false; } 
                        else { if (mode !== activeTab) return false; }
                    }
                    const winnersStr = match[2]; const losersStr = match[3];
                    const winners = winnersStr.split(',').map(n => n.trim()); const losers = losersStr.split(',').map(n => n.trim());
                    const p1InWinners = winners.includes(versusPlayer1); const p2InLosers = losers.includes(versusPlayer2);
                    const p2InWinners = winners.includes(versusPlayer2); const p1InLosers = losers.includes(versusPlayer1);
                    return (p1InWinners && p2InLosers) || (p2InWinners && p1InLosers);
                }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }, [filteredLogs, versusPlayer1, versusPlayer2, viewMode, activeTab]);

            const versusStats = useMemo(() => {
                let p1Wins = 0; let p2Wins = 0;
                versusMatches.forEach(log => {
                    const match = log.content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    const winners = match[2].split(',').map(n => n.trim());
                    if (winners.includes(versusPlayer1)) p1Wins++; else p2Wins++;
                });
                return { p1Wins, p2Wins, total: versusMatches.length };
            }, [versusMatches, versusPlayer1]);

            // Top Vitimas e Nemesis para quando so o P1 ta selecionado
            const singlePlayerVersusStats = useMemo(() => {
                if (viewMode !== 'versus' || (!versusPlayer1 && !versusPlayer2) || (versusPlayer1 && versusPlayer2)) {
                    return { victims: [], nemesis: [], targetPlayer: '' };
                }
                
                const targetPlayer = versusPlayer1 || versusPlayer2;
                const stats = {};

                filteredLogs.forEach(log => {
                    const content = log.content || "";
                    const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (!match) return;
                    const mode = match[1];
                    
                    if (activeTab !== 'Geral') {
                        if (activeTab === 'Ranked') {
                            if (!['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) return;
                        } else {
                            if (mode !== activeTab) return;
                        }
                    }

                    const winners = match[2].split(',').map(n => n.trim()).filter(Boolean);
                    const losers = match[3].split(',').map(n => n.trim()).filter(Boolean);
                    
                    if (winners.includes(targetPlayer)) {
                        losers.forEach(loser => {
                            if (!stats[loser]) stats[loser] = { name: loser, wins: 0, losses: 0, total: 0 };
                            stats[loser].wins++;
                            stats[loser].total++;
                        });
                    } else if (losers.includes(targetPlayer)) {
                        winners.forEach(winner => {
                            if (!stats[winner]) stats[winner] = { name: winner, wins: 0, losses: 0, total: 0 };
                            stats[winner].losses++;
                            stats[winner].total++;
                        });
                    }
                });

                const arr = Object.values(stats);
                const victims = arr.filter(s => s.wins > 0).sort((a,b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return a.losses - b.losses;
                }).slice(0, 10);

                const nemesis = arr.filter(s => s.losses > 0).sort((a,b) => {
                    if (b.losses !== a.losses) return b.losses - a.losses;
                    return a.wins - b.wins;
                }).slice(0, 10);

                return { victims, nemesis, targetPlayer };

            }, [filteredLogs, viewMode, activeTab, versusPlayer1, versusPlayer2]);

            const topRivalries = useMemo(() => {
                if (viewMode !== 'versus') return [];
                const pairs = {};
                
                filteredLogs.forEach(log => {
                    const content = log.content || "";
                    const match = content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (!match) return;
                    const mode = match[1];
                    
                    if (activeTab !== 'Geral') {
                        if (activeTab === 'Ranked') {
                            if (!['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) return;
                        } else {
                            if (mode !== activeTab) return;
                        }
                    }

                    const winners = match[2].split(',').map(n => n.trim()).filter(Boolean);
                    const losers = match[3].split(',').map(n => n.trim()).filter(Boolean);
                    
                    winners.forEach(w => {
                        losers.forEach(l => {
                            if (w === l) return; 
                            const sortedPair = [w, l].sort();
                            const key = `${sortedPair[0]}|||${sortedPair[1]}`;
                            if (!pairs[key]) {
                                pairs[key] = { p1: sortedPair[0], p2: sortedPair[1], total: 0, p1Wins: 0, p2Wins: 0 };
                            }
                            pairs[key].total++;
                            if (w === sortedPair[0]) pairs[key].p1Wins++;
                            else pairs[key].p2Wins++;
                        });
                    });
                });
                
                return Object.values(pairs)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10);
            }, [filteredLogs, viewMode, activeTab]);

            // --- Lógica para "Pesquisar Partidas" ---
            const searchedMatches = useMemo(() => {
                if (viewMode !== 'matches') return [];
                const activeSearch = [matchSearchP1, matchSearchP2, matchSearchP3]
                    .map(n => n.trim().toLowerCase())
                    .filter(Boolean);
                
                if (activeSearch.length === 0) return [];

                return filteredLogs.filter(log => {
                    const match = (log.content || "").match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (!match) return false;
                    
                    const mode = match[1];
                    if (activeTab !== 'Geral') {
                        if (activeTab === 'Ranked') {
                            if (!['Auto1v1', 'Auto2v2', 'Auto3v3'].includes(mode)) return false;
                        } else {
                            if (mode !== activeTab) return false;
                        }
                    }

                    const participants = [...match[2].split(','), ...match[3].split(',')]
                        .map(n => n.trim().toLowerCase())
                        .filter(Boolean);
                    
                    // Todos os jogadores pesquisados devem estar na partida
                    return activeSearch.every(p => participants.some(part => part.includes(p) || part === p));
                }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }, [filteredLogs, matchSearchP1, matchSearchP2, matchSearchP3, viewMode, activeTab]);

            const topComps = useMemo(() => {
                if (viewMode !== 'matches') return { duos: [], trios: [] };
                
                const stats = {};
                
                filteredLogs.forEach(log => {
                    const match = (log.content || "").match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                    if (!match) return;
                    const mode = match[1];
                    if (mode !== 'Auto2v2' && mode !== 'Auto3v3') return;
                    if (activeTab !== 'Geral' && activeTab !== 'Ranked' && activeTab !== mode) return;

                    const winners = match[2].split(',').map(n => n.trim()).filter(Boolean).sort();
                    const losers = match[3].split(',').map(n => n.trim()).filter(Boolean).sort();
                    
                    if ((mode === 'Auto2v2' && winners.length === 2) || (mode === 'Auto3v3' && winners.length === 3)) {
                        const key = winners.join('|||');
                        if (!stats[key]) stats[key] = { names: winners, matchWins: 0, matchLosses: 0, tourneyWins: 0, type: mode === 'Auto2v2' ? 'duo' : 'trio' };
                        stats[key].matchWins++;
                    }
                    if ((mode === 'Auto2v2' && losers.length === 2) || (mode === 'Auto3v3' && losers.length === 3)) {
                        const key = losers.join('|||');
                        if (!stats[key]) stats[key] = { names: losers, matchWins: 0, matchLosses: 0, tourneyWins: 0, type: mode === 'Auto2v2' ? 'duo' : 'trio' };
                        stats[key].matchLosses++;
                    }
                });

                groupedTournaments.forEach(t => {
                    if (t.name !== 'Auto2v2' && t.name !== 'Auto3v3') return;
                    if (activeTab !== 'Geral' && activeTab !== 'Ranked' && activeTab !== t.name) return;

                    const sortedMatches = [...t.matches].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const lastMatch = sortedMatches[sortedMatches.length - 1];
                    if (!lastMatch) return;

                    const winners = [...lastMatch.winners].sort();
                    if ((t.name === 'Auto2v2' && winners.length === 2) || (t.name === 'Auto3v3' && winners.length === 3)) {
                        const key = winners.join('|||');
                        if (!stats[key]) stats[key] = { names: winners, matchWins: 0, matchLosses: 0, tourneyWins: 0, type: t.name === 'Auto2v2' ? 'duo' : 'trio' };
                        stats[key].tourneyWins++;
                    }
                });

                const compsArray = Object.values(stats);

                if (compRankMode === 'best') {
                    compsArray.sort((a, b) => {
                        if (b.tourneyWins !== a.tourneyWins) return b.tourneyWins - a.tourneyWins;
                        if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
                        return a.matchLosses - b.matchLosses;
                    });
                } else {
                    compsArray.sort((a, b) => {
                        if (b.matchLosses !== a.matchLosses) return b.matchLosses - a.matchLosses;
                        return a.matchWins - b.matchWins;
                    });
                }

                return {
                    duos: compsArray.filter(c => c.type === 'duo').slice(0, 10),
                    trios: compsArray.filter(c => c.type === 'trio').slice(0, 10)
                };
            }, [filteredLogs, groupedTournaments, viewMode, activeTab, compRankMode]);


            // --- URL EFFECT (MOVIDO PARA EVITAR TDZ DE groupedTournaments) ---
            useEffect(() => {
                if (!isLoading && data.rankings.length > 0) {
                    const params = new URLSearchParams(window.location.search);
                    
                    const viewParam = params.get('view');
                    if (viewParam && ['ranking', 'versus', 'tournaments', 'matches'].includes(viewParam)) setViewMode(viewParam);

                    const modeParam = params.get('mode'); if (modeParam) setActiveTab(modeParam);
                    const timeParam = params.get('time'); if (timeParam) setTimeFilter(timeParam);
                    const monthParam = params.get('month'); if (monthParam) setTargetMonth(monthParam);

                    const playerParam = params.get('player');
                    const tournamentParam = params.get('tournament');
                    const p1Param = params.get('p1');
                    const p2Param = params.get('p2');

                    if (tournamentParam) {
                        const foundT = groupedTournaments.find(t => t.id === tournamentParam);
                        if (foundT) { setSelectedTournament(foundT); setViewMode('tournaments'); }
                    } else if (playerParam) {
                        const foundP = data.rankings.find(p => p.name.toLowerCase() === playerParam.toLowerCase());
                        if (foundP) {
                            const gStats = globalPlayerStats[foundP.name];
                            let globalBattles = 0;
                            if (gStats) {
                                if (modeParam === 'Geral' || !modeParam) globalBattles = gStats.total;
                                else if (modeParam === 'Ranked') globalBattles = (gStats.modes['Auto1v1'] || 0) + (gStats.modes['Auto2v2'] || 0) + (gStats.modes['Auto3v3'] || 0);
                                else globalBattles = gStats.modes[modeParam] || 0;
                            }
                            const currentBadges = foundP.badges ? foundP.badges.filter(b => b.id !== 'veteran' && b.id !== 'master') : [];
                            const newBadges = [...currentBadges];
                            if (globalBattles >= 1000) newBadges.push({ id: 'master', icon: ShurikenIcon, label: t.icon_master, color: 'text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]' });
                            else if (globalBattles >= 100) newBadges.push({ id: 'veteran', icon: ShurikenIcon, label: t.icon_veteran, color: 'text-blue-400' });
                            
                            setSelectedPlayer({ ...foundP, badges: newBadges });
                        }
                    }

                    if (p1Param) setVersusPlayer1(p1Param);
                    if (p2Param) setVersusPlayer2(p2Param);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, [isLoading, data.rankings, groupedTournaments]); 

            // --- RENDER ---
            // if (isLoading) return (<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8"><div className="w-full max-w-md space-y-4"><div className="flex justify-between items-end"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" /></div><Loader2 className="w-8 h-8 animate-spin text-yellow-500" /></div><Skeleton className="h-32 w-full rounded-xl" /><div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div><div className="text-center text-xs text-slate-500 pt-4">{t.loading}</div></div></div>);
            if (error) return (<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-red-400 p-8 text-center"><AlertCircle className="w-16 h-16 mb-4" /><h2 className="text-2xl font-bold mb-2">{t.error_loading}</h2><p className="max-w-md">{error}</p><button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-white">{t.try_again}</button></div>);

            return (
                <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 pb-16 relative"> 
                    {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} t={t} />}
                    {selectedPlayer && (
                        <PlayerModal 
                            player={selectedPlayer} 
                            history={data.history} 
                            tournaments={groupedTournaments}
                            activeTab={activeTab} 
                            onClose={() => setSelectedPlayer(null)} 
                            onNavigateToPlayer={handlePlayerClick}
                            onOpenTournament={(t) => { setSelectedTournament(t); setSelectedPlayer(null); }} 
                            getShareLink={getShareLink}
                            t={t}
                        />
                    )}
                    {selectedTournament && <TournamentModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} onPlayerClick={handlePlayerClick} getShareLink={getShareLink} t={t} />}

                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Live Ticker */}
                        <LiveTicker logs={rawData} mapData={mapData} blessData={blessData} t={t} />

                        {/* Header */}
                        <div className="flex flex-col lg:flex-row justify-between items-center border-b border-slate-800 pb-6 gap-6 relative mb-8">
                            <div className="flex items-center gap-4 w-full lg:w-auto">
                                <img src={CUSTOM_ICON_URL} alt="Logo" className="w-20 h-20 object-cover rounded-2xl" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                <div className="hidden bg-gradient-to-br from-yellow-500 to-orange-600 p-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center w-20 h-20"><Trophy className="w-10 h-10 text-white" /></div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3"><h1 className="text-4xl font-black text-white tracking-tight">Nin Online <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Tournaments</span></h1><div className="flex items-center gap-2"><button onClick={() => setShowInfoModal(true)} className="bg-slate-800 p-1.5 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-blue-400 border border-slate-700" title="Como usar / Sobre"><HelpCircle className="w-5 h-5" /></button><ShareButton generateUrl={() => getShareLink()} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 h-8" label={t.share} /><LanguageSwitcher currentLang={language} setLang={setLanguage} /></div></div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs font-bold text-slate-300"><ServerIcon className="w-3 h-3 text-blue-400" /><span>{t.server}</span></div>
                                        {dateRange.start && (<div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs font-bold text-slate-300"><Calendar className="w-3 h-3 text-yellow-500" /><span>{dateRange.start} {t.to} {dateRange.end}</span></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Search & Tabs */}
                        <div className="w-full mb-2">
                            <div className="relative group w-full" title={viewMode !== 'ranking' ? t.search_disabled_tooltip : ''}>
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className={`w-6 h-6 transition-colors ${viewMode === 'ranking' ? 'text-slate-500 group-focus-within:text-yellow-500' : 'text-slate-700'}`} />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder={t.search_placeholder} 
                                    className={`w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all shadow-lg text-lg ${viewMode !== 'ranking' ? 'opacity-50 cursor-not-allowed bg-slate-950' : ''}`} 
                                    value={searchTerm} 
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                                    disabled={viewMode !== 'ranking'}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
                            <button onClick={() => setViewMode('ranking')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'ranking' ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Trophy className="w-4 h-4" /> {t.ranking}</button>
                            <button onClick={() => setViewMode('versus')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'versus' ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Swords className="w-4 h-4" /> {t.versus}</button>
                            <button onClick={() => setViewMode('matches')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'matches' ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Crosshair className="w-4 h-4" /> {t.matches_tab}</button>
                            <button onClick={() => setViewMode('tournaments')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'tournaments' ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><GitBranch className="w-4 h-4" /> {t.tournaments}</button>
                            <button onClick={() => setViewMode('maps')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'maps' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><MapIcon className="w-4 h-4" /> Mapas</button>
                            <button onClick={() => setViewMode('blessings')} className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'blessings' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Sparkles className="w-4 h-4" /> Bênçãos</button>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-3 pb-2 border-b border-slate-800 mb-8">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {viewMode === 'maps' && (
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setMapTab('Geral')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${mapTab === 'Geral' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><MapIcon className="w-3.5 h-3.5" /> Visão Geral</button>
                                        <button onClick={() => setMapTab('Ranking')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${mapTab === 'Ranking' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Trophy className="w-3.5 h-3.5" /> Ranking de Mapas</button>
                                        <button onClick={() => setMapTab('Atuais')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${mapTab === 'Atuais' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><ShieldCheck className="w-3.5 h-3.5" /> Mapas Atuais por Vila</button>
                                    </div>
                                )}

                                {viewMode === 'blessings' && (
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setBlessTab('Geral')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${blessTab === 'Geral' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Sparkles className="w-3.5 h-3.5" /> Visão Geral</button>
                                        <button onClick={() => setBlessTab('Ranking')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${blessTab === 'Ranking' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Trophy className="w-3.5 h-3.5" /> Ranking Abençoadores</button>
                                    </div>
                                )}

                                {viewMode !== 'maps' && viewMode !== 'blessings' && (
                                    <div className="flex flex-wrap gap-2">
                                        {modeGroups.main.map(mode => (<button key={mode} onClick={() => { setActiveTab(mode); setShowOtherModes(false); }} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{mode === 'Geral' ? <Filter className="w-3.5 h-3.5" /> : mode === 'Ranked' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}{mode === 'Geral' && language === 'en' ? 'General' : mode}</button>))}
                                        {modeGroups.others.length > 0 && (<div className="relative"><button onClick={() => setShowOtherModes(!showOtherModes)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${modeGroups.others.includes(activeTab) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}><Menu className="w-3.5 h-3.5" />{modeGroups.others.includes(activeTab) ? activeTab : t.others}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOtherModes ? 'rotate-180' : ''}`} /></button>{showOtherModes && (<div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">{modeGroups.others.map(mode => (<button key={mode} onClick={() => { setActiveTab(mode); setShowOtherModes(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-800 ${activeTab === mode ? 'text-yellow-500 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}>{mode}</button>))}</div>)}</div>)}
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:ml-auto w-full md:w-auto">
                                    {timeFilter === 'custom' && (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 w-full sm:w-auto">
                                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1" />
                                            <span className="text-slate-500 text-sm font-bold">~</span>
                                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1" />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <div className="relative group flex-1 sm:w-48"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar className="w-4 h-4 text-slate-500" /></div><select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="appearance-none w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 pl-9 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer hover:bg-slate-800 transition-colors text-sm font-medium"><option value="current_month">{t.current_month}</option><option value="day">{t.day}</option><option value="week">{t.week}</option><option value="specific_month">{t.specific_month}</option><option value="custom">{t.custom_date}</option><option value="all">{t.all}</option></select><div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"><ChevronDown className="w-4 h-4 text-slate-500" /></div></div>
                                        {timeFilter === 'specific_month' && ((viewMode !== 'maps' && viewMode !== 'blessings' && availableMonths.length > 0) || ((viewMode === 'maps' || viewMode === 'blessings') && availableCalendarMonths.length > 0)) && (<div className="relative group flex-1 sm:w-40 animate-in fade-in slide-in-from-left-2 duration-200"><select value={viewMode === 'maps' || viewMode === 'blessings' ? targetCalendarMonth : targetMonth} onChange={(e) => viewMode === 'maps' || viewMode === 'blessings' ? setTargetCalendarMonth(e.target.value) : setTargetMonth(e.target.value)} className="appearance-none w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer text-sm font-medium">{(viewMode === 'maps' || viewMode === 'blessings' ? availableCalendarMonths : availableMonths).map(period => (<option key={period.id} value={period.id}>{period.label}</option>))}</select><div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"><ChevronDown className="w-3 h-3 text-slate-500" /></div></div>)}
                                    </div>
                                </div>
                            </div>
                            {viewMode !== 'maps' && viewMode !== 'blessings' && (
                                <div className="text-slate-400 text-sm flex items-start gap-2 pl-1 animate-in fade-in duration-300"><InfoIcon className="w-4 h-4 mt-0.5 text-slate-500 flex-shrink-0" /><p>{MODE_DESCRIPTIONS[language]?.[activeTab] || t.default_desc}</p></div>
                            )}
                        </div>

                        {/* Views */}
                        {viewMode === 'matches' && (
                            <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
                                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Search className="w-5 h-5 text-blue-500" /> {t.search_matches}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {(matchSearchP1 || matchSearchP2 || matchSearchP3) && (
                                            <button onClick={() => { setMatchSearchP1(''); setMatchSearchP2(''); setMatchSearchP3(''); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-full font-bold text-xs transition-colors whitespace-nowrap">
                                                <XIcon className="w-3.5 h-3.5 inline mr-1" />{t.clear_versus}
                                            </button>
                                        )}
                                        <ShareButton generateUrl={() => getShareLink()} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 h-8" label={t.share} />
                                    </div>
                                </div>

                                {/* 3 Inputs para Pesquisa de Partidas */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    <div className="w-full">
                                        <label className="block text-slate-400 text-sm font-bold mb-2">{t.player} 1</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="w-5 h-5 text-blue-400" /></div>
                                            <input type="text" list="playerList" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t.player_optional} value={matchSearchP1} onChange={(e) => setMatchSearchP1(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <label className="block text-slate-400 text-sm font-bold mb-2">{t.player} 2</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="w-5 h-5 text-blue-400" /></div>
                                            <input type="text" list="playerList" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t.player_optional} value={matchSearchP2} onChange={(e) => setMatchSearchP2(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <label className="block text-slate-400 text-sm font-bold mb-2">{t.player} 3</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="w-5 h-5 text-blue-400" /></div>
                                            <input type="text" list="playerList" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t.player_optional} value={matchSearchP3} onChange={(e) => setMatchSearchP3(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {(matchSearchP1 || matchSearchP2 || matchSearchP3) ? (
                                    searchedMatches.length > 0 ? (
                                        <div className="space-y-3">
                                            {searchedMatches.map((match, idx) => { 
                                                const m = match.content.match(/^\[(.*?)\] (.*?) derrotou (.*)/); 
                                                if (!m) return null; 
                                                const mode = m[1]; 
                                                const winners = m[2].split(',').map(n => n.trim()); 
                                                const losers = m[3].split(',').map(n => n.trim()); 
                                                
                                                const isTarget = (name) => {
                                                    const lName = name.toLowerCase();
                                                    return (matchSearchP1 && lName.includes(matchSearchP1.toLowerCase())) ||
                                                           (matchSearchP2 && lName.includes(matchSearchP2.toLowerCase())) ||
                                                           (matchSearchP3 && lName.includes(matchSearchP3.toLowerCase()));
                                                };

                                                return (
                                                    <div key={idx} onClick={() => handleOpenTournament(mode, match.timestamp)} className="p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative group cursor-pointer transition-all hover:shadow-lg bg-slate-900/50 border-slate-800 hover:border-slate-600">
                                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-yellow-500 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-500/30 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-xl z-10 flex items-center gap-1">
                                                            <Trophy className="w-3 h-3" /> {t.see_tournament}
                                                        </div>
                                                        <div className="flex flex-col gap-2 flex-1 w-full">
                                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 w-fit">{mode}</div>
                                                            <div className="flex flex-col gap-1.5 w-full">
                                                                <div className="flex flex-wrap items-center gap-1 text-sm bg-slate-950/30 p-2 rounded border border-slate-800/50">
                                                                    <span className="text-green-500 font-bold text-[10px] uppercase mr-1 bg-green-500/10 px-1 rounded border border-green-500/20">{t.winners}</span>
                                                                    {winners.map((name, i) => (
                                                                        <span key={i} onClick={(e) => { e.stopPropagation(); handlePlayerClick(name); }} className={`hover:underline cursor-pointer transition-colors ${isTarget(name) ? 'text-blue-400 font-black border-b-2 border-blue-400' : 'text-slate-300 font-medium hover:text-white'}`} title={t.player}>{name}{i < winners.length - 1 ? ',' : ''}</span>
                                                                    ))}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1 text-sm bg-slate-950/30 p-2 rounded border border-slate-800/50">
                                                                    <span className="text-red-500 font-bold text-[10px] uppercase mr-1 bg-red-500/10 px-1 rounded border border-red-500/20">{t.losers}</span>
                                                                    {losers.map((name, i) => (
                                                                        <span key={i} onClick={(e) => { e.stopPropagation(); handlePlayerClick(name); }} className={`hover:underline cursor-pointer transition-colors ${isTarget(name) ? 'text-red-400 font-black border-b-2 border-red-400' : 'text-slate-400 font-medium hover:text-white'}`} title={t.player}>{name}{i < losers.length - 1 ? ',' : ''}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0 flex md:flex-col items-center md:items-end justify-between w-full md:w-auto mt-2 md:mt-0 border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
                                                            <div className="text-xs text-slate-500 font-mono">{new Date(match.timestamp).toLocaleDateString('pt-BR')}</div>
                                                            <div className="text-xs text-slate-500 mt-1 font-mono">{new Date(match.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
                                                        </div>
                                                    </div>
                                                ); 
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>{t.no_match}</p>
                                        </div>
                                    )
                                ) : (
                                    <div className="mt-4 animate-in fade-in duration-500">
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg border ${compRankMode === 'best' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                                                    {compRankMode === 'best' ? <Crown className="w-5 h-5 text-yellow-500" /> : <Skull className="w-5 h-5 text-red-500" />}
                                                </div>
                                                <h3 className="text-xl font-bold text-white">{t.comps_title}</h3>
                                            </div>
                                            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                                                <button onClick={() => setCompRankMode('best')} className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${compRankMode === 'best' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t.sort_best}</button>
                                                <button onClick={() => setCompRankMode('worst')} className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${compRankMode === 'worst' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t.sort_worst}</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {/* Top Duos */}
                                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                                                <h4 className="text-blue-400 font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2"><Users className="w-4 h-4"/> {t.duos}</h4>
                                                {topComps.duos.length > 0 ? topComps.duos.map((comp, idx) => (
                                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg mb-2 flex items-center justify-between hover:bg-slate-800 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-500 font-bold text-sm w-5">#{idx+1}</span>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-white font-bold text-sm">{comp.names[0]}</span>
                                                                    <span className="text-slate-600 text-xs">&</span>
                                                                    <span className="text-white font-bold text-sm">{comp.names[1]}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold">
                                                            <div className="flex flex-col items-end" title={t.t_wins}>
                                                                <span className="flex items-center gap-1 text-yellow-500"><Trophy className="w-3 h-3"/> {comp.tourneyWins}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end" title={t.wins}>
                                                                <span className="flex items-center gap-1 text-green-400"><Swords className="w-3 h-3"/> {comp.matchWins}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end" title={t.losses}>
                                                                <span className="flex items-center gap-1 text-red-500"><Skull className="w-3 h-3"/> {comp.matchLosses}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : <div className="text-slate-500 text-sm border border-dashed border-slate-800 p-4 rounded-lg text-center">Nenhuma dupla encontrada.</div>}
                                            </div>

                                            {/* Top Trios */}
                                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                                                <h4 className="text-purple-400 font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2"><Users className="w-4 h-4"/> {t.trios}</h4>
                                                {topComps.trios.length > 0 ? topComps.trios.map((comp, idx) => (
                                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg mb-2 flex items-center justify-between hover:bg-slate-800 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-500 font-bold text-sm w-5">#{idx+1}</span>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-white font-bold text-sm">{comp.names[0]}</span>
                                                                    <span className="text-slate-600 text-xs">,</span>
                                                                    <span className="text-white font-bold text-sm">{comp.names[1]}</span>
                                                                    <span className="text-slate-600 text-xs">&</span>
                                                                    <span className="text-white font-bold text-sm">{comp.names[2]}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold">
                                                            <div className="flex flex-col items-end" title={t.t_wins}>
                                                                <span className="flex items-center gap-1 text-yellow-500"><Trophy className="w-3 h-3"/> {comp.tourneyWins}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end" title={t.wins}>
                                                                <span className="flex items-center gap-1 text-green-400"><Swords className="w-3 h-3"/> {comp.matchWins}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end" title={t.losses}>
                                                                <span className="flex items-center gap-1 text-red-500"><Skull className="w-3 h-3"/> {comp.matchLosses}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : <div className="text-slate-500 text-sm border border-dashed border-slate-800 p-4 rounded-lg text-center">Nenhum trio encontrado.</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === 'versus' && (
                             <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
                                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Swords className="w-5 h-5 text-red-500" /> {t.direct_match}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {(versusPlayer1 || versusPlayer2) && (
                                            <button onClick={() => { setVersusPlayer1(''); setVersusPlayer2(''); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-full font-bold text-xs transition-colors whitespace-nowrap">
                                                <XIcon className="w-3.5 h-3.5 inline mr-1" />{t.clear_versus}
                                            </button>
                                        )}
                                        <ShareButton generateUrl={() => getShareLink()} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 h-8" label={t.share} />
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-end mb-8 relative">
                                    <div className="flex-1 w-full"><label className="block text-slate-400 text-sm font-bold mb-2">{t.player1}</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="w-5 h-5 text-blue-400" /></div><input type="text" list="playerList" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder={t.player1} value={versusPlayer1} onChange={(e) => setVersusPlayer1(e.target.value)} /></div></div>
                                    <div className="flex items-center justify-center pb-3"><div className="bg-slate-800 p-2 rounded-full border border-slate-700"><Swords className="w-6 h-6 text-slate-500" /></div></div>
                                    <div className="flex-1 w-full"><label className="block text-slate-400 text-sm font-bold mb-2">{t.player2}</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="w-5 h-5 text-red-400" /></div><input type="text" list="playerList" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500/50" placeholder={t.player2} value={versusPlayer2} onChange={(e) => setVersusPlayer2(e.target.value)} /></div></div>
                                    <datalist id="playerList">{data.rankings.map(p => <option key={p.name} value={p.name} />)}</datalist>
                                </div>
                                {(versusPlayer1 && versusPlayer2) ? (
                                    versusMatches.length > 0 ? (
                                        <React.Fragment>
                                            <div className="mb-8 space-y-4"><div className="flex items-center gap-3"><span className="text-xs text-blue-400 font-bold w-12 text-right">{((versusStats.p1Wins/versusStats.total)*100).toFixed(0)}%</span><div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex"><div style={{ width: `${(versusStats.p1Wins/versusStats.total)*100}%` }} className="h-full bg-blue-500"></div><div style={{ width: `${(versusStats.p2Wins/versusStats.total)*100}%` }} className="h-full bg-red-500"></div></div><span className="text-xs text-red-400 font-bold w-12">{((versusStats.p2Wins/versusStats.total)*100).toFixed(0)}%</span></div></div>
                                            <div className="flex justify-center items-center gap-8 mb-4"><div className="text-center"><div className="text-4xl font-black text-blue-500">{versusStats.p1Wins}</div><div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{versusPlayer1}</div></div><div className="text-slate-600 text-2xl font-black">X</div><div className="text-center"><div className="text-4xl font-black text-red-500">{versusStats.p2Wins}</div><div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{versusPlayer2}</div></div></div>
                                            
                                            {/* Linha do Tempo (Timeline do Versus) */}
                                            <div className="flex items-center gap-1.5 overflow-x-auto py-4 mb-8 scrollbar-thin px-2 justify-start sm:justify-center w-full bg-slate-950/30 rounded-lg border border-slate-800/50 shadow-inner">
                                                {versusMatches.slice().reverse().map((match, i) => {
                                                     const m = match.content.match(/^\[(.*?)\] (.*?) derrotou (.*)/);
                                                     if (!m) return null;
                                                     const winners = m[2].split(',').map(n => n.trim());
                                                     const isP1 = winners.includes(versusPlayer1);
                                                     const dateStr = new Date(match.timestamp).toLocaleDateString('pt-BR');
                                                     const timeStr = new Date(match.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                                                     return (
                                                         <div key={i} 
                                                              onClick={() => handleOpenTournament(m[1], match.timestamp)}
                                                              title={`[${m[1]}] ${isP1 ? versusPlayer1 : versusPlayer2} venceu em ${dateStr} às ${timeStr}`}
                                                              className={`cursor-pointer w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white border-2 hover:scale-125 hover:z-10 transition-transform shadow-lg relative group ${isP1 ? 'bg-blue-600 border-blue-400' : 'bg-red-600 border-red-400'}`}>
                                                             {isP1 ? 'V' : 'D'}
                                                         </div>
                                                     )
                                                })}
                                            </div>

                                            <div className="space-y-3">{versusMatches.map((match, idx) => { const m = match.content.match(/^\[(.*?)\] (.*?) derrotou (.*)/); if (!m) return null; const mode = m[1]; const winners = m[2].split(',').map(n => n.trim()); const losers = m[3].split(',').map(n => n.trim()); const isP1Winner = winners.includes(versusPlayer1); return (<div key={idx} onClick={() => handleOpenTournament(mode, match.timestamp)} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative group cursor-pointer transition-all hover:shadow-lg ${isP1Winner ? 'bg-blue-900/10 border-blue-500/20 hover:border-blue-500/40' : 'bg-red-900/10 border-red-500/20 hover:border-red-500/40'}`}><div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-yellow-500 text-[10px] font-bold px-3 py-1 rounded-full border border-yellow-500/30 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-xl z-10 flex items-center gap-1"><Trophy className="w-3 h-3" /> {t.see_tournament}</div><div className="flex flex-col gap-2 flex-1 w-full"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 w-fit">{mode}</div><div className="flex flex-col gap-1.5 w-full"><div className="flex flex-wrap items-center gap-1 text-sm bg-slate-950/30 p-2 rounded border border-slate-800/50"><span className="text-green-500 font-bold text-[10px] uppercase mr-1 bg-green-500/10 px-1 rounded border border-green-500/20">{t.winners}</span>{winners.map((name, i) => { const isTarget = name === versusPlayer1 || name === versusPlayer2; const colorClass = name === versusPlayer1 ? 'text-blue-400' : name === versusPlayer2 ? 'text-red-400' : 'text-slate-400'; return (<span key={i} onClick={(e) => { e.stopPropagation(); handlePlayerClick(name); }} className={`${colorClass} hover:underline hover:text-white cursor-pointer transition-colors ${isTarget ? 'font-black text-base border-b-2 border-current' : 'font-medium'}`} title="Ver histórico do jogador">{name}{i < winners.length - 1 ? ',' : ''}</span>); })}</div><div className="flex flex-wrap items-center gap-1 text-sm bg-slate-950/30 p-2 rounded border border-slate-800/50"><span className="text-red-500 font-bold text-[10px] uppercase mr-1 bg-red-500/10 px-1 rounded border border-red-500/20">{t.losers}</span>{losers.map((name, i) => { const isTarget = name === versusPlayer1 || name === versusPlayer2; const colorClass = name === versusPlayer1 ? 'text-blue-400' : name === versusPlayer2 ? 'text-red-400' : 'text-slate-500'; return (<span key={i} onClick={(e) => { e.stopPropagation(); handlePlayerClick(name); }} className={`${colorClass} hover:underline hover:text-white cursor-pointer transition-colors ${isTarget ? 'font-black text-base border-b-2 border-current' : 'font-medium'}`} title="Ver histórico do jogador">{name}{i < losers.length - 1 ? ',' : ''}</span>); })}</div></div></div><div className="text-right flex-shrink-0 flex md:flex-col items-center md:items-end justify-between w-full md:w-auto mt-2 md:mt-0 border-t md:border-t-0 border-slate-800 pt-2 md:pt-0"><div className={`text-sm font-black px-3 py-1 rounded border ${isP1Winner ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>{isP1Winner ? t.victory_p1 : t.defeat_p1}</div><div className="text-xs text-slate-500 mt-1 font-mono">{new Date(match.timestamp).toLocaleDateString('pt-BR')}</div></div></div>); })}</div>
                                        </React.Fragment>
                                    ) : (
                                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl"><Swords className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>{t.no_match}</p></div>
                                    )
                                ) : (versusPlayer1 || versusPlayer2) ? (
                                    <div className="mt-4 animate-in fade-in duration-500">
                                        <div className="mb-6 flex justify-between items-center bg-slate-800 border border-slate-700 p-4 rounded-xl">
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Estatísticas VS para <span className="text-blue-400">{singlePlayerVersusStats.targetPlayer}</span></h3>
                                                <p className="text-xs text-slate-400 mt-1">Selecione um oponente ao lado para ver o histórico de confrontos diretos.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Vitimas */}
                                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                                                <h4 className="text-green-400 font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2"><Swords className="w-4 h-4"/> {t.top_victims}</h4>
                                                {singlePlayerVersusStats.victims.length > 0 ? singlePlayerVersusStats.victims.map((v, idx) => (
                                                    <div key={idx} onClick={() => { if(versusPlayer1) setVersusPlayer2(v.name); else setVersusPlayer1(v.name); }} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg mb-2 flex items-center justify-between hover:bg-slate-800 hover:border-green-500/30 transition-colors cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-500 font-bold text-sm w-5">#{idx+1}</span>
                                                            <span className="text-white font-bold group-hover:text-green-400 transition-colors">{v.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <span className="font-black text-green-500">{v.wins} V</span>
                                                            <span className="text-slate-600">/</span>
                                                            <span className="font-bold text-red-500">{v.losses} D</span>
                                                        </div>
                                                    </div>
                                                )) : <div className="text-slate-500 text-sm border border-dashed border-slate-800 p-4 rounded-lg text-center">Nenhuma vítima encontrada.</div>}
                                            </div>
                                            {/* Nemesis */}
                                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                                                <h4 className="text-red-500 font-bold mb-4 uppercase tracking-wider text-sm flex items-center gap-2"><Skull className="w-4 h-4"/> {t.top_nemesis}</h4>
                                                {singlePlayerVersusStats.nemesis.length > 0 ? singlePlayerVersusStats.nemesis.map((n, idx) => (
                                                    <div key={idx} onClick={() => { if(versusPlayer1) setVersusPlayer2(n.name); else setVersusPlayer1(n.name); }} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg mb-2 flex items-center justify-between hover:bg-slate-800 hover:border-red-500/30 transition-colors cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-slate-500 font-bold text-sm w-5">#{idx+1}</span>
                                                            <span className="text-white font-bold group-hover:text-red-500 transition-colors">{n.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <span className="font-bold text-green-500">{n.wins} V</span>
                                                            <span className="text-slate-600">/</span>
                                                            <span className="font-black text-red-500">{n.losses} D</span>
                                                        </div>
                                                    </div>
                                                )) : <div className="text-slate-500 text-sm border border-dashed border-slate-800 p-4 rounded-lg text-center">Nenhum nêmesis encontrado.</div>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 animate-in fade-in duration-500">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-orange-500/20 p-2 rounded-lg border border-orange-500/30"><Flame className="w-5 h-5 text-orange-500" /></div>
                                            <h3 className="text-xl font-bold text-white">{t.top_rivalries}</h3>
                                        </div>
                                        {topRivalries.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {topRivalries.map((rivalry, idx) => {
                                                    const p1Leading = rivalry.p1Wins >= rivalry.p2Wins;
                                                    const p2Leading = rivalry.p2Wins >= rivalry.p1Wins;
                                                    return (
                                                        <div key={idx} onClick={() => { setVersusPlayer1(rivalry.p1); setVersusPlayer2(rivalry.p2); }} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-col cursor-pointer hover:border-orange-500/50 hover:bg-slate-800/80 hover:-translate-y-1 transition-all group shadow-md">
                                                            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">#{idx + 1} Rivalidade</span><span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-bold border border-slate-700">{rivalry.total} {t.battles}</span></div>
                                                            <div className="flex items-center justify-between w-full"><div className="flex flex-col items-start w-[40%]"><span className={`font-bold truncate w-full text-sm sm:text-base ${p1Leading ? 'text-white' : 'text-slate-400'}`}>{rivalry.p1}</span><span className="text-xl sm:text-2xl font-black text-blue-500">{rivalry.p1Wins}</span></div><div className="flex flex-col items-center justify-center px-2"><Swords className="w-5 h-5 text-slate-600 group-hover:text-orange-500 transition-colors" /></div><div className="flex flex-col items-end w-[40%]"><span className={`font-bold truncate w-full text-right text-sm sm:text-base ${p2Leading ? 'text-white' : 'text-slate-400'}`}>{rivalry.p2}</span><span className="text-xl sm:text-2xl font-black text-red-500">{rivalry.p2Wins}</span></div></div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl"><p>Nenhuma rivalidade encontrada para este filtro.</p></div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {viewMode === 'ranking' && (
                            <React.Fragment>


                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    <Card title={t.active_players} value={filteredRankings.length} icon={Users} colorClass="text-blue-400 bg-blue-500" />
                                    <Card title={t.total_battles} value={totalBattles} icon={Swords} colorClass="text-red-400 bg-red-500" />
                                    <Card title={t.most_wins} value={mostWinsPlayer ? mostWinsPlayer.name : '-'} icon={Crown} colorClass="text-yellow-400 bg-yellow-500" />
                                    <Card title={t.on_fire} value={highestStreakPlayer ? `${highestStreakPlayer.name} (${highestStreakPlayer.displayStreak})` : '-'} icon={Flame} colorClass="text-orange-400 bg-orange-500" />
                                </div>
                                <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                    <th className="p-5 w-20 text-center">#</th>
                                                    <th className="p-5 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>{t.player} <SortIndicator active={sortConfig.key === 'name'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-yellow-400 transition-colors" onClick={() => handleSort('tournamentWins')}>{t.t_wins} <SortIndicator active={sortConfig.key === 'tournamentWins'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('tournamentsPlayed')}>{t.t_played} <SortIndicator active={sortConfig.key === 'tournamentsPlayed'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-green-400 transition-colors" onClick={() => handleSort('wins')}>{t.wins} <SortIndicator active={sortConfig.key === 'wins'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-red-400 transition-colors" onClick={() => handleSort('losses')}>{t.losses} <SortIndicator active={sortConfig.key === 'losses'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('battles')}>{t.battles} <SortIndicator active={sortConfig.key === 'battles'} direction={sortConfig.direction} /></th>
                                                    <th className="p-5 text-center cursor-pointer hover:text-green-400 transition-colors" onClick={() => handleSort('winRate')}>{t.win_rate} <SortIndicator active={sortConfig.key === 'winRate'} direction={sortConfig.direction} /></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {paginatedRankings.map((player, index) => {
                                                    let rankColor = "text-slate-500", rankIcon = null;
                                                    const realRank = player.realRankPosition;
                                                    if (realRank === 1) { rankColor = "text-yellow-500"; rankIcon = <Crown className="w-5 h-5" />; }
                                                    if (realRank === 2) { rankColor = "text-slate-300"; rankIcon = <Crown className="w-5 h-5" />; }
                                                    if (realRank === 3) { rankColor = "text-amber-700"; rankIcon = <Crown className="w-5 h-5" />; }

                                                    return (
                                                        <tr key={player.name} onClick={() => setSelectedPlayer(player)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group">
                                                            <td className={`p-5 text-center font-bold ${rankColor} text-lg`}>
                                                                {rankIcon ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        {rankIcon} <span>#{realRank}</span>
                                                                    </div>
                                                                ) : (
                                                                    `#${realRank}`
                                                                )}
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-white group-hover:text-yellow-400 transition-colors text-lg">
                                                                            <HighlightText text={player.name} highlight={searchTerm} />
                                                                        </span>
                                                                        {player.displayStreak >= 3 && <span title={`${player.displayStreak} ${t.icon_streak_win}`}><Flame className="w-4 h-4 text-orange-500 animate-pulse" /></span>}
                                                                        {player.displayStreak <= -3 && <span title={`${Math.abs(player.displayStreak)} ${t.icon_streak_loss}`}><Skull className="w-4 h-4 text-slate-500" /></span>}
                                                                        {player.badges.map((b, bIdx) => (<b.icon key={bIdx} className={`w-3.5 h-3.5 ${b.color}`} title={b.label} />))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-5 text-center font-bold text-yellow-500 text-lg">{player.tournamentWins}</td>
                                                            <td className="p-5 text-center text-slate-400">{player.tournamentsPlayed}</td>
                                                            <td className="p-5 text-center font-bold text-slate-200">{player.wins}</td>
                                                            <td className="p-5 text-center font-medium text-slate-500">{player.losses}</td>
                                                            <td className="p-5 text-center text-slate-400">{player.battles}</td>
                                                            <td className="p-5 text-center"><div className="flex flex-col items-center gap-1"><span className={`text-xs font-bold px-2 py-1 rounded-full ${parseFloat(player.winRate) >= 60 ? 'bg-green-500/20 text-green-400' : parseFloat(player.winRate) >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{player.winRate}%</span></div></td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredRankings.length === 0 && (<tr><td colSpan="8" className="p-12 text-center text-slate-500"><div className="flex flex-col items-center gap-3"><Users className="w-12 h-12 text-slate-700" /><p>{t.no_player_found}</p></div></td></tr>)}
                                            </tbody>
                                        </table>
                                    </div>
{totalPages > 1 && (<div className="flex justify-center items-center gap-4 mt-6"><button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button><span className="text-slate-400 text-sm">Página <span className="text-white font-bold">{currentPage}</span> de {totalPages}</span><button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronRight className="w-5 h-5" /></button></div>)}
                                </div>
                            </React.Fragment>
                        )}
                        
                        {viewMode === 'tournaments' && (
                            <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead><tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider"><th className="p-5">{t.date}</th><th className="p-5">{t.tournament}</th><th className="p-5 text-center">{t.battles}</th><th className="p-5 text-right">{t.time}</th></tr></thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {Object.entries(tournamentsByDate).map(([date, tournaments]) => (
                                                <React.Fragment key={date}>
                                                    <tr className="bg-slate-900/80 border-b border-slate-800"><td colSpan="4" className="p-3 px-5 text-yellow-500 font-bold text-xs uppercase tracking-wider sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">{date}</td></tr>
                                                    {tournaments.map(tournament => (<tr key={tournament.id} onClick={() => setSelectedTournament(tournament)} className="hover:bg-slate-800/50 cursor-pointer transition-colors group"><td className="p-5 text-slate-400 font-mono text-sm"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-600" />{tournament.date}</div></td><td className="p-5 font-bold text-white group-hover:text-yellow-400 transition-colors text-lg">{tournament.name}</td><td className="p-5 text-center text-slate-400"><span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold border border-slate-700">{tournament.matches.length} {t.battles}</span></td><td className="p-5 text-right text-slate-500 group-hover:text-white transition-colors"><div className="flex items-center justify-end gap-2 font-mono text-sm"><Clock className="w-4 h-4 text-slate-600" />{getRoundedTime(tournament.timestamp)}</div></td></tr>))}
                                                </React.Fragment>
                                            ))}
                                            {groupedTournaments.length === 0 && (<tr><td colSpan="4" className="p-12 text-center text-slate-500"><div className="flex flex-col items-center gap-3"><Trophy className="w-12 h-12 text-slate-700 opacity-50" /><p>{t.no_tournament_found}</p></div></td></tr>)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {viewMode === 'maps' && (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Estatísticas de Mapas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><MapIcon className="w-4 h-4" /> Posse Atual de Mapas</h4>
                                        <div className="flex flex-col gap-3">
                                            {mapStats.currentOwnership.map(([village, count], idx) => (
                                                <div key={village} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg text-white">{idx + 1}º</span>
                                                        <span className="font-bold text-blue-400">{village}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xl font-black text-white">{count}</span>
                                                        <span className="text-xs text-slate-400 font-bold uppercase">mapas</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {mapStats.currentOwnership.length === 0 && <span className="text-slate-500 text-sm">Nenhum mapa dominado ainda.</span>}
                                        </div>
                                    </div>

                                    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" /> Top Conquistadores (Período)</h4>
                                        <div className="flex flex-col gap-3">
                                            {mapStats.topConquerors.slice(0, 5).map(([village, count], idx) => (
                                                <div key={village} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg text-yellow-500">#{idx + 1}</span>
                                                        <span className="font-bold text-white">{village}</span>
                                                    </div>
                                                    <span className="font-bold text-slate-400">{count} conquistas</span>
                                                </div>
                                            ))}
                                            {mapStats.topConquerors.length === 0 && <span className="text-slate-500 text-sm">Nenhuma conquista neste período.</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 p-6">
                                    <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2 mb-6"><MapIcon className="w-6 h-6" /> {mapTab === 'Geral' ? 'Histórico de Mapas' : mapTab === 'Ranking' ? 'Ranking de Mapas' : 'Mapas Atuais por Vila'}</h3>
                                    
                                    {mapTab === 'Ranking' ? (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                            <th className="p-5 w-16 text-center">Pos</th>
                                                            <th className="p-5">Mapa</th>
                                                            <th className="p-5">Vilas Conquistadoras</th>
                                                            <th className="p-5 text-center text-blue-400">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {paginatedMapRank.map(([mapName, stats], idx) => (
                                                            <tr key={mapName} className="hover:bg-slate-800/50 transition-colors">
                                                                <td className="p-5 text-center font-bold text-slate-500">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                                                <td className="p-5 font-bold text-white text-lg">{mapName}</td>
                                                                <td className="p-5">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(stats.villages).sort((a,b) => b[1] - a[1]).map(([v, count]) => (
                                                                            <span key={v} className="px-2 py-1 bg-slate-800 rounded-md text-xs font-bold text-slate-300 flex items-center gap-1">
                                                                                {v}: <span className="text-blue-400">{count}</span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="p-5 text-center font-black text-blue-400 text-xl">{stats.total}</td>
                                                            </tr>
                                                        ))}
                                                        {mapStats.topConqueredMaps.length === 0 && (
                                                            <tr><td colSpan="4" className="p-10 text-center text-slate-500">Nenhum mapa registrado.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {totalMapRankPages > 1 && (
                                                <div className="p-4 border-t border-slate-800 flex justify-center items-center gap-4 bg-slate-900 mt-4 rounded-xl">
                                                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                                    <span className="text-sm text-slate-400 font-medium">Página <span className="text-white font-bold">{currentPage}</span> de {totalMapRankPages}</span>
                                                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalMapRankPages))} disabled={currentPage === totalMapRankPages} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                                </div>
                                            )}
                                        </>
                                    ) : mapTab === 'Atuais' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {mapStats.currentOwnershipDetailed.map(([village, maps]) => (
                                                <div key={village} className="bg-slate-950 rounded-xl p-5 border border-slate-800 shadow-md flex flex-col">
                                                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                                                        <h4 className="font-black text-lg text-white">{village}</h4>
                                                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full font-bold text-sm">{maps.length} Mapas</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 flex-1 content-start">
                                                        {maps.sort().map(m => (
                                                            <span key={m} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 shadow-sm">{m}</span>
                                                        ))}
                                                        {maps.length === 0 && <span className="text-slate-500 text-sm italic">Nenhum mapa conquistado</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            {mapStats.currentOwnershipDetailed.length === 0 && (
                                                <div className="col-span-full text-center py-10 text-slate-500">Nenhum mapa registrado.</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {paginatedMaps.map((m, i) => (
                                                <div key={i} className="p-4 rounded-xl border border-blue-500/20 bg-blue-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 hover:border-blue-500/40 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/20 rounded-lg"><MapIcon className="w-5 h-5 text-blue-400" /></div>
                                                        <div><span className="font-bold text-white">{m.content.split(' capturou ')[0].replace('[Mapa] ', '')}</span> capturou <span className="font-bold text-blue-300">{m.content.split(' capturou ')[1]}</span></div>
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(m.timestamp).toLocaleString('pt-BR')}</div>
                                                </div>
                                            ))}
                                            {paginatedMaps.length === 0 && <div className="text-center py-10 text-slate-500">Nenhuma conquista de mapa registrada.</div>}
                                        </div>
                                    )}
                                    {mapTab === 'Geral' && totalMapPages > 1 && (
                                        <div className="p-4 border-t border-slate-800 flex justify-center items-center gap-4 bg-slate-900 mt-4 rounded-xl">
                                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                            <span className="text-sm text-slate-400 font-medium">Página <span className="text-white font-bold">{currentPage}</span> de {totalMapPages}</span>
                                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalMapPages))} disabled={currentPage === totalMapPages} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {viewMode === 'blessings' && (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Estatísticas de Bênçãos */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl border border-slate-800 flex flex-col justify-center items-center text-center">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Maior Combo (Período)</h4>
                                        <div className="text-3xl font-black text-purple-500 mb-1">{blessStats.maxStreak}x</div>
                                        <div className="font-bold text-white">{blessStats.maxStreakPerson}</div>
                                    </div>
                                    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl border border-slate-800 flex flex-col justify-center items-center text-center">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Top Abençoador</h4>
                                        <div className="text-2xl font-black text-yellow-400 mb-1">{blessStats.topGivers.length > 0 ? blessStats.topGivers[0][0] : '-'}</div>
                                        <div className="text-sm text-slate-400">{blessStats.topGivers.length > 0 ? `${blessStats.topGivers[0][1].total} bençãos` : ''}</div>
                                    </div>
                                    <div className="bg-slate-900 rounded-2xl p-5 shadow-xl border border-slate-800 flex flex-col justify-center items-center text-center gap-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipos (Período)</h4>
                                        <div className="w-full flex justify-between px-4">
                                            <div className="flex flex-col items-center"><span className="text-xl font-black text-pink-400">{blessStats.xpCount}</span><span className="text-xs font-bold text-slate-500">XP</span></div>
                                            <div className="flex flex-col items-center"><span className="text-xl font-black text-green-400">{blessStats.dropCount}</span><span className="text-xs font-bold text-slate-500">DROP</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 p-6">
                                    <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2 mb-6"><Sparkles className="w-6 h-6" /> {blessTab === 'Geral' ? 'Histórico de Bênçãos' : 'Ranking de Abençoadores'}</h3>
                                    
                                    {blessTab === 'Ranking' ? (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                            <th className="p-5 w-16 text-center">Pos</th>
                                                            <th className="p-5">Abençoador</th>
                                                            <th className="p-5 text-center text-pink-400">XP</th>
                                                            <th className="p-5 text-center text-green-400">Drop</th>
                                                            <th className="p-5 text-center text-purple-400">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {paginatedBlessRank.map(([name, stats], idx) => (
                                                            <tr key={name} className="hover:bg-slate-800/50 transition-colors">
                                                                <td className="p-5 text-center font-bold text-slate-500">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                                                <td className="p-5 font-bold text-white text-lg">{name}</td>
                                                                <td className="p-5 text-center font-bold text-pink-400">{stats.xp}</td>
                                                                <td className="p-5 text-center font-bold text-green-400">{stats.drop}</td>
                                                                <td className="p-5 text-center font-black text-purple-400 text-xl">{stats.total}</td>
                                                            </tr>
                                                        ))}
                                                        {blessStats.topGivers.length === 0 && (
                                                            <tr><td colSpan="5" className="p-10 text-center text-slate-500">Nenhuma benção registrada.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {totalBlessRankPages > 1 && (
                                                <div className="p-4 border-t border-slate-800 flex justify-center items-center gap-4 bg-slate-900 mt-4 rounded-xl">
                                                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                                    <span className="text-sm text-slate-400 font-medium">Página <span className="text-white font-bold">{currentPage}</span> de {totalBlessRankPages}</span>
                                                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalBlessRankPages))} disabled={currentPage === totalBlessRankPages} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-3 mt-4">
                                            {paginatedBlessings.map((m, idx) => {
                                                const isXP = m.type === 'XP';
                                                const bgIcon = isXP ? 'bg-pink-500/20' : 'bg-green-500/20';
                                                const textIcon = isXP ? 'text-pink-400' : 'text-green-400';
                                                const borderCard = isXP ? 'border-pink-500/20' : 'border-green-500/20';
                                                const textName = isXP ? 'text-pink-300' : 'text-green-300';
                                                const textFooter = isXP ? 'text-pink-200/70' : 'text-green-200/70';

                                                return (
                                                <div key={idx} className={`bg-slate-900 border ${borderCard} rounded-xl p-4 flex justify-between items-center shadow-md hover:bg-slate-800/50 transition-colors group`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 ${bgIcon} rounded-lg`}><Sparkles className={`w-5 h-5 ${textIcon}`} /></div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-white">{m.content.split(' abençoou ')[0].replace('[Bênção] ', '')}</span> 
                                                                <span className="text-slate-400">abençoou</span> 
                                                                <span className={`font-bold ${textName}`}>{m.content.split(' abençoou ')[1]}</span>
                                                                {m.type && <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isXP ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>{m.type}</span>}
                                                            </div>
                                                            {m.footer && <div className={`text-sm ${textFooter} italic mt-1`}>"{m.footer}"</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(m.timestamp).toLocaleDateString('pt-BR')} {new Date(m.timestamp).toLocaleTimeString('pt-BR')}
                                                    </div>
                                                </div>
                                            )})}
                                            {paginatedBlessings.length === 0 && <div className="text-center py-10 text-slate-500">Nenhuma benção registrada.</div>}
                                        </div>
                                    )}
                                    {blessTab === 'Geral' && totalBlessPages > 1 && (
                                        <div className="p-4 border-t border-slate-800 flex justify-center items-center gap-4 bg-slate-900 mt-4 rounded-xl">
                                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                            <span className="text-sm text-slate-400 font-medium">Página <span className="text-white font-bold">{currentPage}</span> de {totalBlessPages}</span>
                                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalBlessPages))} disabled={currentPage === totalBlessPages} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="text-center text-[10px] text-slate-700 mt-8 pb-4">{t.files_loaded} {loadedFilesCount}</div>
                    </div>
                </div>
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
