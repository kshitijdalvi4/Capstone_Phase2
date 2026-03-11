import { useState, useEffect } from 'react';
import { CheckCircle, Eye, EyeOff, Brain, ChevronRight, Zap, List, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import axios from 'axios';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useProblem } from '../contexts/ProblemContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import CodeEditor from './CodeEditor';
import MCQSection from './MCQSection';
import Timer from './Timer';
import OptimalSolution from './OptimalSolution';
import ProblemListModal from './ProblemListModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProblemSolver() {
  const { currentProblem, selectProblem } = useProblem();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submitKeyBinding, theme, fontSize } = useUserPreferences();
  const [showProblemList, setShowProblemList] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [phase, setPhase] = useState<'reading' | 'mcq' | 'coding' | 'completed'>('reading');
  const [showOptimalSolution, setShowOptimalSolution] = useState(false);
  const [solutionWorked, setSolutionWorked] = useState<boolean | null>(null);
  const [extraHints, setExtraHints] = useState<string[]>([]);
  const [generatingHint, setGeneratingHint] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [successProbability, setSuccessProbability] = useState<number | null>(null);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);

  const { id } = useParams();
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');

  // Sync with URL
  useEffect(() => {
    if (id && (!currentProblem || currentProblem.id !== id)) {
      selectProblem(id);
    }
  }, [id, currentProblem, selectProblem]);

  // Reset state when problem changes
  useEffect(() => {
    setPhase('reading');
    setIsCompleted(false);
    setShowOptimalSolution(false);
    setTimerRunning(false);
    setCurrentHintIndex(0);
    setShowHint(false);
    setSolutionWorked(null);
    setExtraHints([]);
    setSuccessProbability(null);
  }, [currentProblem?.id]);

  // Fetch success probability
  useEffect(() => {
    const fetchPrediction = async () => {
      if (user && currentProblem) {
        try {
          // Try to get from user.successScores first for speed
          if (user.successScores && user.successScores[currentProblem.id]) {
            setSuccessProbability(user.successScores[currentProblem.id]);
          } else {
            // Fallback to real-time prediction
            const response = await axios.post('http://localhost:8000/api/predict-success', {
              userId: user.id,
              problemId: currentProblem.id
            });
            if (response.data.success) {
              setSuccessProbability(response.data.probability);
            }
          }
        } catch (error) {
          console.error("Failed to fetch success prediction", error);
        }
      }
    };
    fetchPrediction();
  }, [currentProblem?.id, user?.id]);

  // Combined hints
  const allHints = [...(currentProblem?.hints || []), ...extraHints];

  const generateAIHint = async () => {
    setGeneratingHint(true);
    try {
      const response = await axios.post('http://localhost:5001/api/ai/hint', {
        problemTitle: currentProblem?.title,
        problemDescription: currentProblem?.description,
        currentCode: currentProblem?.id ? localStorage.getItem(`code-${currentProblem.id}`) : ""
      });

      if (response.data.hint) {
        setExtraHints(prev => [...prev, response.data.hint]);
        setCurrentHintIndex(allHints.length); // Jump to new hint
        setShowHint(true);
      }
    } catch (error) {
      console.error("Failed to generate AI hint", error);
    } finally {
      setGeneratingHint(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (phase === 'coding' && timerRunning) {
      interval = setInterval(() => {
        if (!showHint) {
          setShowHint(true);
        }
      }, 420000); // 7 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, timerRunning, showHint]);

  // Handle key bindings for submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'coding') return;

      const keys = submitKeyBinding.split('+');
      const mainKey = keys[keys.length - 1];
      const hasMeta = keys.includes('Meta') || keys.includes('Cmd'); // Meta is Cmd on Mac
      const hasCtrl = keys.includes('Ctrl');
      const hasShift = keys.includes('Shift');
      const hasAlt = keys.includes('Alt');

      const isMainKey = e.key.toLowerCase() === mainKey.toLowerCase();
      const matchMeta = hasMeta ? e.metaKey : !e.metaKey;
      const matchCtrl = hasCtrl ? e.ctrlKey : !e.ctrlKey;
      const matchShift = hasShift ? e.shiftKey : !e.shiftKey;
      const matchAlt = hasAlt ? e.altKey : !e.altKey;

      if (isMainKey && matchMeta && matchCtrl && matchShift && matchAlt) {
        e.preventDefault();
        handleComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, submitKeyBinding]);

  if (!currentProblem) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold uppercase tracking-widest text-xs mb-6">No problem selected</p>
          <button
            onClick={() => setShowProblemList(true)}
            className="flex items-center gap-2 px-4 py-2 mx-auto rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all text-sm font-medium border border-zinc-700 hover:border-zinc-600"
          >
            <List className="w-4 h-4" />
            Browse Problems
          </button>
        </div>
        <ProblemListModal
          isOpen={showProblemList}
          onClose={() => setShowProblemList(false)}
        />
      </div>
    );
  }

  const handleStartCoding = () => {
    setPhase('coding');
    setTimerRunning(true);
    setStartTime(Date.now());
  };

  const handleComplete = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionError(null);
    try {
      if (!code) {
        setExecutionError("No code found to submit.");
        setIsExecuting(false);
        return;
      }

      // Prepare test cases
      const testCases = currentProblem.testCases.map(tc => ({
        input: tc.input,
        expected_output: tc.output
      }));

      // Call Execution API
      // Call Execution API
      const response = await axios.post('http://127.0.0.1:5002/execute', {
        language: language,
        code: code,
        test_cases: testCases,
        method_name: currentProblem.methodName || 'solution'
      });

      const result = response.data;
      console.log("Execution Result:", result); // DEBUG

      setPhase('completed');
      setTimerRunning(false);
      setShowOptimalSolution(true);

      if (result.success) {
        setSolutionWorked(true);
        setExecutionError(null); // Clear any previous errors
      } else {
        setSolutionWorked(false);

        // Find the first failed test case to show error
        if (result.results && result.results.length > 0) {
          const failedCase = result.results.find((r: any) => !r.passed);
          if (failedCase) {
            console.log("Failed Logic:", failedCase); // DEBUG
            if (failedCase.error) {
              setExecutionError(`Execution Error: ${failedCase.error}`);
            } else {
              setExecutionError(`Test Failed: Input: ${failedCase.input}, Expected: ${failedCase.expected_output}, Got: ${failedCase.actual_output}`);
            }
          } else {
            // Fallback if success is false but no specific failed case found (unlikely)
            setExecutionError("Unknown execution failure. Please check your code.");
          }
        } else {
          setExecutionError(result.error || "Execution failed without results.");
        }
      }

      // Log Interaction
      console.log("Logging Interaction - User:", user, "StartTime:", startTime); // DEBUG

      const timeTakenCalculated = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      const userIdToLog = user ? user.id : 'anonymous'; // Fallback if user context is missing, though unlikely if logged in
      const usernameToLog = user ? (user.username || user.email.split('@')[0]) : 'anonymous';

      if (userIdToLog) {
        await axios.post('http://localhost:5001/api/interactions', {
          userId: userIdToLog,
          username: usernameToLog,
          problemId: currentProblem.id,
          title: currentProblem.title,
          language: language,
          submissionStatus: result.success ? 1 : 0,
          timeTakenSeconds: timeTakenCalculated,
          runtimeMs: result.metric_runtime_ms || 0,
          memoryUsedKB: result.metric_memory_kb || 0
        });
      }

    } catch (err: any) {
      console.error("Execution failed:", err);
      setExecutionError(err.message || "Failed to execute code.");
      setPhase('completed');
      setTimerRunning(false);
      setShowOptimalSolution(true);
      setSolutionWorked(false);

      // Log failed execution due to error (status 0)
      if (user && startTime) {
        const timeTakenSeconds = Math.floor((Date.now() - startTime) / 1000);
        await axios.post('http://localhost:5001/api/interactions', {
          userId: user.id,
          problemId: currentProblem.id,
          language: language,
          submissionStatus: 0,
          timeTakenSeconds: timeTakenSeconds,
          runtimeMs: 0,
          memoryUsedKB: 0
        });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSolutionFeedback = (worked: boolean) => {
    setSolutionWorked(worked);
    if (!worked) {
      setPhase('reading');
      setIsCompleted(false);
      setShowOptimalSolution(false);
      setTimerRunning(false);
    }
  };

  const nextHint = () => {
    if (currentHintIndex < allHints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  return (
    <div
      className={`h-screen flex flex-col font-sans transition-colors duration-300 ${theme === 'vs-dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
        }`}
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Top Console Bar */}
      <div className={`${theme === 'vs-dark' ? 'bg-zinc-900/50 shadow-black/20' : 'bg-white shadow-zinc-200'} backdrop-blur-md border-b ${theme === 'vs-dark' ? 'border-zinc-800' : 'border-zinc-200'} p-3 flex-shrink-0 z-20 shadow-sm transition-colors`}>
        <div className="max-w-full mx-auto flex items-center justify-between px-4">
          <div className="flex items-center space-x-8">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center cursor-pointer hover:bg-violet-600/30 transition-all"
                onClick={() => navigate('/')}
                title="Back to Landing Page"
              >
                <Zap className="h-4 w-4 text-violet-500" />
              </div>
              <div className="hidden sm:block">
                <button
                  onClick={() => setShowProblemList(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium border ${theme === 'vs-dark'
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700 hover:border-zinc-600'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border-zinc-200'
                    }`}
                >
                  <List className="w-4 h-4" />
                  Problem List
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6 border-l border-zinc-800 pl-8">
              <Timer
                running={timerRunning}
                successProbability={successProbability}
                acceptanceRate={currentProblem?.acceptanceRate}
              />

              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Status</span>
                  {isCompleted ? (
                    <div className="flex items-center text-emerald-400 text-xs font-bold">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      SUBMITTED
                    </div>
                  ) : (
                    <div className="flex items-center text-amber-500 text-xs font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-2"></div>
                      LIVE
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Phase</span>
                  <div className={`${theme === 'vs-dark' ? 'bg-zinc-800 text-white border-white/5' : 'bg-zinc-100 text-zinc-700 border-zinc-200'} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border`}>
                    {phase}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHint(!showHint)}
              className={`flex items-center px-4 py-2 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border ${theme === 'vs-dark'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/5'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                }`}
            >
              <Lightbulb className="h-3.5 w-3.5 mr-2 text-amber-400" />
              Request Hint
            </button>

            {phase === 'coding' && (
              <button
                onClick={handleComplete}
                className="flex items-center px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Solution
              </button>
            )}

            {isExecuting && (
              <div className="flex items-center px-4 py-2 bg-zinc-800 text-zinc-400 border border-white/5 rounded-xl font-bold text-xs uppercase tracking-wider">
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Assessing...
              </div>
            )}

            {phase === 'completed' && showOptimalSolution && (
              <button
                onClick={() => setShowOptimalSolution(!showOptimalSolution)}
                className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              >
                {showOptimalSolution ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showOptimalSolution ? 'Hide' : 'Reveal'} Solution
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hint Banner */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500/10 border-b border-amber-500/20 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 leading-none">
                    Intelligent Guidance • {currentHintIndex + 1} / {allHints.length}
                  </h3>
                  <p className={`text-sm font-medium transition-colors ${theme === 'vs-dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>{allHints[currentHintIndex]}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-6">
                {currentHintIndex < allHints.length - 1 ? (
                  <button
                    onClick={nextHint}
                    className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-widest flex items-center"
                  >
                    Next Logic Step <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={generateAIHint}
                    disabled={generatingHint}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-violet-500/30"
                  >
                    {generatingHint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generatingHint ? "Thinking..." : "Ask AI"}
                  </button>
                )}
                <button
                  onClick={() => setShowHint(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                >
                  ✕
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Core Interaction Engine */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/5 blur-[120px] rounded-full pointer-events-none"></div>

        <PanelGroup direction="horizontal">
          <Panel defaultSize={45} minSize={30}>
            <div className={`h-full backdrop-blur-sm overflow-y-auto border-r transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950/40 border-zinc-800/50' : 'bg-white border-zinc-200'
              }`}>
              <div className="p-8 md:p-10 space-y-10">
                <section>
                  <div className="flex items-center gap-3 mb-6 relative">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
                    <div
                      className="relative"
                      onMouseEnter={() => setIsHoveringTitle(true)}
                      onMouseLeave={() => setIsHoveringTitle(false)}
                    >
                      <h1 className={`text-3xl font-bold tracking-tight transition-colors cursor-help ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {currentProblem.title}
                      </h1>

                      <AnimatePresence>
                        {isHoveringTitle && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute left-0 top-full mt-4 z-[60] w-80 p-5 rounded-2xl border backdrop-blur-xl shadow-2-xl ${theme === 'vs-dark'
                              ? 'bg-zinc-900/90 border-white/10 shadow-black/40'
                              : 'bg-white/90 border-zinc-200 shadow-zinc-200/50'
                              }`}
                          >
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></div>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target Companies</span>
                            </div>

                            {currentProblem.companies && currentProblem.companies.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {currentProblem.companies.map((company, i) => (
                                  <motion.span
                                    key={company}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${theme === 'vs-dark'
                                      ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-violet-500/20 hover:border-violet-500/30'
                                      : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-violet-500/10 hover:border-violet-500/20'
                                      }`}
                                  >
                                    {company}
                                  </motion.span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-500 italic">No specific company data available for this question.</div>
                            )}

                            {/* Decorative tail */}
                            <div className={`absolute -top-1.5 left-6 w-3 h-3 rotate-45 border-l border-t ${theme === 'vs-dark' ? 'bg-zinc-900/90 border-white/10' : 'bg-white/90 border-zinc-200'
                              }`}></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-8">
                    <span className={`px - 2 py - 0.5 rounded - md text - [10px] font - bold uppercase tracking - widest ${currentProblem.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      currentProblem.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      } `}>
                      {currentProblem.difficulty}
                    </span>
                    {currentProblem.tags.map((tag) => (
                      <span key={tag} className={`text-[10px] font-bold uppercase tracking-wider py-1 transition-colors ${theme === 'vs-dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        # {tag}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <p className={`leading-relaxed font-medium whitespace-pre-line p-5 rounded-2xl border transition-colors ${theme === 'vs-dark' ? 'text-zinc-300 bg-zinc-900/40 border-white/5' : 'text-zinc-700 bg-zinc-100/50 border-zinc-200'
                      }`}>
                      {currentProblem.description}
                    </p>
                  </div>
                </section>


                <section className="space-y-6">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Critical Constraints
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentProblem.constraints.map((constraint, index) => (
                      <div key={index} className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                        }`}>
                        <div className={`w-1 h-1 rounded-full ${theme === 'vs-dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`}></div>
                        {constraint}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logic Use Cases</h4>
                  <div className="space-y-6">
                    {currentProblem.testCases.map((testCase, index) => (
                      <div key={index} className={`glass-panel p-6 rounded-2xl relative group transition-all overflow-hidden border ${theme === 'vs-dark' ? 'bg-zinc-900/40 border-white/10 hover:border-violet-500/20' : 'bg-zinc-100 border-zinc-200 hover:border-violet-500/30 shadow-sm'
                        }`}>
                        <div className="absolute top-0 right-0 p-4 text-[10px] font-bold text-zinc-800 group-hover:text-zinc-700 transition-colors uppercase">
                          Case {index + 1}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className={`text-[10px] font-bold uppercase mb-2 tracking-widest ${theme === 'vs-dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Input Stream</div>
                            <div className={`font-mono text-sm p-3 rounded-xl border transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950 border-white/5 text-violet-400' : 'bg-white border-zinc-200 text-violet-600'
                              }`}>{testCase.input}</div>
                          </div>
                          <div>
                            <div className={`text-[10px] font-bold uppercase mb-2 tracking-widest ${theme === 'vs-dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Expected Output</div>
                            <div className={`font-mono text-sm p-3 rounded-xl border transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950 border-white/5 text-emerald-400' : 'bg-white border-zinc-200 text-emerald-600'
                              }`}>{testCase.output}</div>
                          </div>
                          {testCase.explanation && (
                            <div className={`text-xs italic pt-2 border-t ${theme === 'vs-dark' ? 'text-zinc-500 border-zinc-800' : 'text-zinc-500 border-zinc-200'}`}>
                              <span className={`font-bold uppercase tracking-widest mr-2 not-italic text-[10px] ${theme === 'vs-dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Context:</span>
                              {testCase.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {phase === 'reading' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12"
                  >
                    <button
                      onClick={() => setPhase('mcq')}
                      className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] flex items-center justify-center gap-3"
                    >
                      Initialize Logic Check <Brain className="w-5 h-5" />
                    </button>
                    <p className={`text-center text-[10px] font-bold uppercase tracking-[0.2em] mt-4 transition-colors ${theme === 'vs-dark' ? 'text-zinc-600 opacity-50' : 'text-zinc-400'}`}>
                      Step 1 of 3 • Knowledge Gathering
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className={`w-1.5 transition-all cursor-col-resize z-10 flex items-center justify-center group ${theme === 'vs-dark' ? 'bg-zinc-900 hover:bg-violet-600/50' : 'bg-zinc-200 hover:bg-violet-600/30'
            }`}>
            <div className={`w-0.5 h-8 rounded-full ${theme === 'vs-dark' ? 'bg-zinc-800 group-hover:bg-white/40' : 'bg-zinc-300 group-hover:bg-zinc-500'}`}></div>
          </PanelResizeHandle>

          <Panel defaultSize={55} minSize={30}>
            <div className="h-full bg-zinc-950">
              <AnimatePresence mode="wait">
                {showOptimalSolution && phase === 'completed' ? (
                  <motion.div
                    key="optimal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <OptimalSolution
                      problem={currentProblem}
                      onSolutionFeedback={handleSolutionFeedback}
                      solutionWorked={solutionWorked}
                      executionError={executionError}
                      initialLanguage={language}
                      userCode={code}
                    />
                  </motion.div>

                ) : (
                  <motion.div
                    key="editor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    <CodeEditor
                      onStartCoding={handleStartCoding}
                      phase={phase}
                      language={language}
                      onLanguageChange={setLanguage}
                      code={code}
                      onCodeChange={setCode}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <AnimatePresence>
        {phase === 'mcq' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-zinc-950 z-[100] overflow-hidden flex flex-col"
          >
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-600/10 via-zinc-900 to-zinc-900">
              <MCQSection
                key={currentProblem.id}
                forceTheme="vs-dark"
                onClose={() => setPhase('reading')}
                onComplete={() => {
                  setPhase('coding');
                  setTimerRunning(true);
                  setStartTime(Date.now());
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProblemListModal
        isOpen={showProblemList}
        onClose={() => setShowProblemList(false)}
      />
    </div >
  );
}
