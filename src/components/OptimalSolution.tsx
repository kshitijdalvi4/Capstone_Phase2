import { useState, useEffect } from 'react';
import { XCircle, Code2, BookOpen, RotateCcw, Zap, Target, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

import { Problem } from '../data/problems';

interface OptimalSolutionProps {
  problem: Problem;
  onSolutionFeedback: (worked: boolean) => void;
  solutionWorked: boolean | null;
  executionError?: string | null;
  initialLanguage?: string;
  userCode?: string;
}

export default function OptimalSolution({
  problem,
  onSolutionFeedback,
  solutionWorked,
  executionError,
  initialLanguage = 'python',
  userCode
}: OptimalSolutionProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const { theme, fontSize } = useUserPreferences();
  const [intelligenceInsights, setIntelligenceInsights] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Fetch intelligence insights when the component mounts and we have userCode
  useEffect(() => {
    const fetchInsights = async () => {
      if (!userCode || !problem) return;

      setIsLoadingInsights(true);
      try {
        const response = await fetch('http://localhost:5002/api/analyze-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: userCode,
            language: language,
            problem_title: problem.title,
            problem_description: problem.description,
            optimal_time_complexity: problem.optimalTimeComplexity || problem.timeComplexity || 'O(n)',
            optimal_space_complexity: problem.optimalSpaceComplexity || problem.spaceComplexity || 'O(n)'
          })
        });

        const data = await response.json();
        if (data.success && data.insights && data.insights.length > 0) {
          setIntelligenceInsights(data.insights);
        } else {
          setIntelligenceInsights([
            `Optimal Time Complexity: ${problem.optimalTimeComplexity || problem.timeComplexity || 'O(n)'} for efficient processing of input data.`,
            `Optimal Space Complexity: ${problem.optimalSpaceComplexity || problem.spaceComplexity || 'O(n)'} to balance memory usage and performance.`,
            "This solution uses industry-standard patterns to ensure reliability and scalability.",
            "The implementation handles edge cases and large input sizes according to the problem constraints."
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch intelligence insights", err);
        setIntelligenceInsights([
          `Optimal Time Complexity: ${problem.optimalTimeComplexity || problem.timeComplexity || 'O(n)'} for efficient processing of input data.`,
          `Optimal Space Complexity: ${problem.optimalSpaceComplexity || problem.spaceComplexity || 'O(n)'} to balance memory usage and performance.`,
          "Could not generate dynamic analysis at this time.",
          "Please review the optimal solution approaches above."
        ]);
      } finally {
        setIsLoadingInsights(false);
      }
    };

    fetchInsights();
  }, [problem, userCode, language]);

  const languages = [
    { id: 'python', name: 'Python' },
    { id: 'cpp', name: 'C++' },
    { id: 'java', name: 'Java' }
  ];

  const approaches = [
    {
      name: 'Brute Force',
      timeComplexity: problem.bruteForceTimeComplexity || 'O(n²)',
      spaceComplexity: problem.bruteForceSpaceComplexity || 'O(1)',
      description: 'Check every pair of numbers to find the target sum.',
      pros: ['Simple to understand', 'No extra space needed'],
      cons: ['Inefficient for large arrays', 'Quadratic time complexity']
    },
    {
      name: 'Optimal Solution',
      timeComplexity: problem.optimalTimeComplexity || problem.timeComplexity || 'O(n)',
      spaceComplexity: problem.optimalSpaceComplexity || problem.spaceComplexity || 'O(n)',
      description: 'Optimal approach using efficient algorithms/data structures.',
      pros: ['Best time complexity', 'Optimized resource usage'],
      cons: []
    }
  ];

  // Use dynamic optimal solution from MongoDB
  const getDynamicCode = () => {
    if (!problem.optimalSolution || problem.optimalSolution === "AI will generate this...") {
      return '// Optimal solution is being prepared by AI. Please check back in a moment.';
    }

    if (Array.isArray(problem.optimalSolution)) {
      const solution = problem.optimalSolution.find(s => s.language === language);
      if (!solution) return `// Solution not available for ${language}`;
      return solution.code || '// Solution being prepared';
    }

    // Fallback for legacy string format (only for python)
    if (typeof problem.optimalSolution === 'string') {
      return problem.optimalSolution;
    }

    return '// Solution not available';
  };

  const currentCode = getDynamicCode();

  return (
    <div className={`h-full flex flex-col transition-colors duration-300 ${theme === 'vs-dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Header Station */}
      <div className={`p-6 flex-shrink-0 border-b transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h3 className={`text-xl font-bold tracking-tight ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>Post-Solve Engine</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Performance Analysis & Optimization</p>
            </div>
          </div>

          <div className={`p-1.5 rounded-xl border transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950 border-white/5' : 'bg-zinc-100 border-zinc-200 shadow-inner'
            }`}>
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${language === lang.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Module */}
        <AnimatePresence mode="wait">
          {solutionWorked === null ? (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Verify Outcome</h4>
                  <p className="text-zinc-400 text-xs font-medium">Did your implementation pass all test cases in production?</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onSolutionFeedback(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                >
                  Confirm Success
                </button>
                <button
                  onClick={() => onSolutionFeedback(false)}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5"
                >
                  Report Failure
                </button>
              </div>
            </motion.div>
          ) : solutionWorked === true ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-1">Objective Completed</h4>
                <p className="text-zinc-400 text-xs font-medium">Advanced algorithmic logic confirmed. Accuracy: 100%.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="failure"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <XCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400 uppercase tracking-widest mb-1">Solution Failed</h4>
                  <p className="text-zinc-400 text-xs font-medium">
                    {executionError ? (
                      <span className="font-mono bg-rose-950/50 px-2 py-1 rounded text-rose-300 block mt-1 border border-rose-500/20">
                        {executionError}
                      </span>
                    ) : (
                      "Implementation did not pass all test cases. Review the logic below."
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSolutionFeedback(false)}
                className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Initialize Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Analysis Workspace */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar p-8 space-y-12">
        {/* Solution Architectures */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
            <h3 className={`text-lg font-bold tracking-tight ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>Solution Architectures</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {approaches.map((approach, index) => (
              <div key={index} className={`p-6 rounded-3xl border relative transition-all group hover:scale-[1.02] ${approach.name.includes('Optimal')
                ? theme === 'vs-dark'
                  ? 'bg-violet-600/10 border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.1)]'
                  : 'bg-violet-50 border-violet-200 shadow-sm'
                : theme === 'vs-dark'
                  ? 'bg-zinc-900 border-white/5'
                  : 'bg-white border-zinc-200 shadow-sm'
                }`}>
                {approach.name.includes('Optimal') && (
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-violet-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-full shadow-lg">
                    Recommended Path
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`font-bold text-lg ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>{approach.name}</h4>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex flex-col items-end">
                      <span className="text-violet-400 font-mono">T: {approach.timeComplexity}</span>
                      <span className="text-fuchsia-400 font-mono">S: {approach.spaceComplexity}</span>
                    </div>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 font-medium">{approach.description}</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950/40 border-white/5' : 'bg-white border-zinc-200'}`}>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] block mb-2">Capabilities</span>
                      <ul className="space-y-1.5">
                        {approach.pros.map((pro, i) => (
                          <li key={i} className="text-[11px] text-emerald-400/80 font-medium flex gap-2">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5"></div>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`p-4 rounded-xl border transition-colors ${theme === 'vs-dark' ? 'bg-zinc-950/40 border-white/5' : 'bg-white border-zinc-200'}`}>
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] block mb-2">Trade-offs</span>
                      <ul className="space-y-1.5">
                        {approach.cons.map((con, i) => (
                          <li key={i} className="text-[11px] text-rose-400/80 font-medium flex gap-2">
                            <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5"></div>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Blueprint Viewer */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-fuchsia-600 rounded-full"></div>
              <h3 className={`text-lg font-bold tracking-tight ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>Technical Blueprint</h3>
            </div>
            <div className={`border rounded-lg px-3 py-1 flex items-center gap-2 transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-zinc-200'
              }`}>
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Read Only</span>
            </div>
          </div>
          <div className="relative group/code">
            <div className="absolute top-0 right-0 p-4 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
              <button className="p-2 bg-zinc-800 hover:bg-violet-600 text-zinc-400 hover:text-white rounded-lg transition-all border border-white/10">
                <Zap className="w-4 h-4" />
              </button>
            </div>
            <div className={`rounded-[32px] p-8 border overflow-hidden shadow-inner transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-zinc-200 shadow-zinc-200'
              }`}>
              <pre className={`font-mono text-sm leading-relaxed overflow-x-auto scroll-none transition-colors ${theme === 'vs-dark' ? 'text-zinc-100' : 'text-zinc-800'}`}>
                <code className="block py-4">{currentCode}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Intelligence Summary */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
            <h3 className={`text-lg font-bold tracking-tight ${theme === 'vs-dark' ? 'text-white' : 'text-zinc-900'}`}>Intelligence Summary - Gemini Analysis</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isLoadingInsights ? (
              <div className={`col-span-1 border sm:col-span-2 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-zinc-200 shadow-sm'}`}>
                <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-violet-500 animate-spin"></div>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Gemini is analyzing your code logic...</p>
              </div>
            ) : intelligenceInsights.length > 0 ? (
              intelligenceInsights.map((insight, idx) => (
                <div key={idx} className={`p-5 rounded-2xl border flex gap-4 transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900/40 border-white/5 hover:border-violet-500/20' : 'bg-white border-zinc-200 hover:border-violet-500/30 shadow-sm'
                  }`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${theme === 'vs-dark' ? 'bg-zinc-950' : 'bg-zinc-100'
                    }`}>
                    <span className="text-[10px] font-bold text-violet-500">{idx + 1}</span>
                  </div>
                  <p className="text-zinc-400 text-xs font-medium leading-relaxed">{insight}</p>
                </div>
              ))
            ) : (
              [
                `Optimal Time Complexity: ${problem.optimalTimeComplexity || problem.timeComplexity || 'O(n)'} for efficient processing of input data.`,
                `Optimal Space Complexity: ${problem.optimalSpaceComplexity || problem.spaceComplexity || 'O(n)'} to balance memory usage and performance.`,
                "This solution uses industry-standard patterns to ensure reliability and scalability.",
                "The implementation handles edge cases and large input sizes according to the problem constraints."
              ].map((insight, idx) => (
                <div key={idx} className={`p-5 rounded-2xl border flex gap-4 transition-colors ${theme === 'vs-dark' ? 'bg-zinc-900/40 border-white/5 hover:border-violet-500/20' : 'bg-white border-zinc-200 hover:border-violet-500/30 shadow-sm'
                  }`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${theme === 'vs-dark' ? 'bg-zinc-950' : 'bg-zinc-100'
                    }`}>
                    <span className="text-[10px] font-bold text-violet-500">{idx + 1}</span>
                  </div>
                  <p className="text-zinc-400 text-xs font-medium leading-relaxed">{insight}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}