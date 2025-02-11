import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface Question {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  all_answers?: string[];
}

async function translateText(text: string, retryCount = 0): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 segundo

  try {
    // Intentamos primero con MyMemory
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`);
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    
    // Si falla y aún tenemos reintentos, probamos con LibreTranslate
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      
      const libreTResponse = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target: 'es'
        })
      });
      
      const libreTData = await libreTResponse.json();
      if (libreTData.translatedText) {
        return libreTData.translatedText;
      }
      
      return translateText(text, retryCount + 1);
    }
    
    // Si todos los intentos fallan, devolvemos el texto original
    console.warn('Translation failed after all retries, using original text:', text);
    return text;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return translateText(text, retryCount + 1);
    }
    console.error('Translation failed completely:', error);
    return text;
  }
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://opentdb.com/api.php?amount=10&category=17');
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const translatedQuestions = await Promise.all(data.results.map(async (q: Question) => {
          const [translatedQuestion, translatedCorrectAnswer, ...translatedIncorrectAnswers] = await Promise.all([
            translateText(q.question),
            translateText(q.correct_answer),
            ...q.incorrect_answers.map(answer => translateText(answer))
          ]);

          const allAnswers = [translatedCorrectAnswer, ...translatedIncorrectAnswers]
            .sort(() => Math.random() - 0.5);

          return {
            ...q,
            question: translatedQuestion,
            correct_answer: translatedCorrectAnswer,
            incorrect_answers: translatedIncorrectAnswers,
            all_answers: allAnswers
          };
        }));

        setQuestions(translatedQuestions);
        setCurrentQuestion(0);
        setCorrectAnswers(0);
        setSelectedAnswer('');
        setShowResult(false);
      } else {
        setError('No se pudieron cargar las preguntas. Por favor, intenta de nuevo.');
      }
    } catch (error) {
      setError('Error al cargar las preguntas. Por favor, verifica tu conexión e intenta de nuevo.');
      console.error('Error fetching questions:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const getCurrentAnswers = () => {
    if (!questions[currentQuestion]) return [];
    return questions[currentQuestion].all_answers || [];
  };

  const handleAnswer = () => {
    if (selectedAnswer === questions[currentQuestion].correct_answer) {
      setCorrectAnswers(prev => prev + 1);
    }
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer('');
    } else {
      setShowResult(true);
    }
  };

  const handleNewTest = () => {
    fetchQuestions();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin">
          <RefreshCw className="w-8 h-8 text-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-center text-gray-800 mb-4">{error}</p>
          <button
            onClick={handleNewTest}
            className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <p className="text-center text-gray-800 mb-4">No hay preguntas disponibles.</p>
          <button
            onClick={handleNewTest}
            className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Quiz App</h1>
            <button
              onClick={handleNewTest}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Nuevo Test
            </button>
          </div>

          {!showResult ? (
            <>
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Pregunta {currentQuestion + 1} de {questions.length}</span>
                  <span>Aciertos: {correctAnswers}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-800 mb-4" 
                    dangerouslySetInnerHTML={{ __html: questions[currentQuestion]?.question || '' }}>
                </h2>
                <div className="space-y-3">
                  {getCurrentAnswers().map((answer, index) => (
                    <label
                      key={index}
                      className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={answer}
                        checked={selectedAnswer === answer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        className="w-4 h-4 text-blue-500"
                      />
                      <span className="ml-3" dangerouslySetInnerHTML={{ __html: answer }}></span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAnswer}
                disabled={!selectedAnswer}
                className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Responder
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="mb-4">
                {correctAnswers >= questions.length / 2 ? (
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                )}
              </div>
              <h2 className="text-2xl font-bold mb-4">¡Test Completado!</h2>
              <p className="text-lg mb-6">
                Has acertado {correctAnswers} de {questions.length} preguntas
              </p>
              <button
                onClick={handleNewTest}
                className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Intentar Nuevo Test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;