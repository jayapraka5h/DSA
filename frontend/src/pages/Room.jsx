import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const Room = () => {
  const { roomId } = useParams();
  const { state } = useLocation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [socket, setSocket] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chat, setChat] = useState([]);
  const [renderError, setRenderError] = useState(null);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('// Write your solution here...');
  const [language, setLanguage] = useState('python');
  const [role, setRole] = useState('Viewer');
  const [editorId, setEditorId] = useState(null);
  const [controlRequests, setControlRequests] = useState([]);
  const [question, setQuestion] = useState(null);
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [stdin, setStdin] = useState('');
  const stdinRef = useRef('');   // always mirrors latest stdin to avoid stale closure
  const [consoleTab, setConsoleTab] = useState('input');
  
  const pin = state?.pin || 'Private';

  if (!user) {
      return (
          <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
             <h2>Loading Study Room...</h2>
          </div>
      );
  }

  useEffect(() => {
    // Connect to WebSockets
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.emit('join_room', { roomId, username: user.username, userId: user.id });

    newSocket.on('room_info', (info) => {
      setEditorId(info.editorSocketId);
      setParticipants(info.participants);
      setRole(info.yourRole);
      setQuestion(info.question);
    });

    newSocket.on('user_joined', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('user_left', (data) => {
      setParticipants(data.participants);
    });

    newSocket.on('receive_code', (data) => {
       setCode(data.code);
    });

    newSocket.on('receive_message', (data) => {
       setChat((prev) => [...prev, data]);
    });

    newSocket.on('control_requested', (data) => {
        setControlRequests(prev => [...prev, data]);
    });

    newSocket.on('editor_changed', (data) => {
        setEditorId(data.newEditorSocketId);
        // Automatically check if the new editor is ME
        if (data.newEditorSocketId === newSocket.id) {
            setRole('Editor');
        } else if (role === 'Editor') {
            setRole('Viewer');
        }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user.username, user.id]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socket) {
      socket.emit('code_change', { roomId, code: newCode });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      socket.emit('send_message', { roomId, username: user.username, message });
      setMessage('');
    }
  };

  const requestControl = () => {
    if (socket) {
        socket.emit('request_control', { roomId, username: user.username });
        alert('Control request sent to the current editor.');
    }
  };

  const grantControl = (requesterSocketId) => {
    if (socket) {
        socket.emit('transfer_control', { roomId, newEditorSocketId: requesterSocketId });
        setControlRequests(prev => prev.filter(req => req.requesterSocketId !== requesterSocketId));
    }
  };

  const isCurrentEditor = socket && socket.id === editorId;

  const JUDGE0_LANG_MAP = {
      javascript: 93, // Node.js 18.15.0
      python: 71,     // Python 3.10.1
      java: 91,       // Java 17.0.6
      c: 50,          // GCC 9.2.0
      cpp: 54         // GCC 9.2.0
  };

  const LANG_BOILERPLATES = {
      javascript: '// Write your JavaScript solution here...\n\nconsole.log("Hello, World!");\n',
      python: '# Write your Python solution here...\n\nprint("Hello, World!")\n',
      java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
      c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
      cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n'
  };

  const handleLanguageChange = (newLang) => {
      setLanguage(newLang);
      
      // Always inject boilerplate when switching — overwrite if it looks like a default
      const isDefaultCode = Object.values(LANG_BOILERPLATES).includes(code)
          || code.trim() === ''
          || code.trim() === '// Write your solution here...';
      
      if (isDefaultCode) {
          const newBoilerplate = LANG_BOILERPLATES[newLang];
          setCode(newBoilerplate);
          if (socket && isCurrentEditor) {
              socket.emit('code_change', { roomId, code: newBoilerplate });
          }
      }
  };

  // Auto-detect the correct language from code contents to prevent wrong-language errors
  const detectLanguage = (src) => {
      if (/^\s*import\s+java\.|public\s+class\s+\w+|System\.out\.print/.test(src)) return 'java';
      if (/^\s*#include\s*<(iostream|string|vector|map)>/.test(src)) return 'cpp';
      if (/^\s*#include\s*<(stdio|stdlib)\.h>/.test(src)) return 'c';
      if (/^\s*(def |import |print\(|from \w+ import)/.test(src)) return 'python';
      return null; // Cannot detect, use selected language
  };

  const runCode = async () => {
      setIsExecuting(true);
      setConsoleTab('output'); // Auto-switch to output tab when running

      // Auto-detect language from code and switch if needed
      const detectedLang = detectLanguage(code);
      const effectiveLang = detectedLang || language;
      if (detectedLang && detectedLang !== language) {
          setLanguage(detectedLang);
          setOutput(`⚡ Auto-detected language: ${detectedLang.toUpperCase()}\nRunning code on Judge0 Public API...`);
      } else {
          setOutput('Running code...\nExecuting remotely on Judge0 Public API.');
      }
      
      try {
          // Pre-process Java code: rename the main class to "Main" (required by Judge0)
          let sourceCode = code;
          if (effectiveLang === 'java') {
              // Find the class that contains the main method and rename it to Main
              sourceCode = sourceCode.replace(/(public\s+class\s+)\w+/, '$1Main');
              // Also handle non-public class with main method
              sourceCode = sourceCode.replace(/(class\s+)\w+(\s*\{[\s\S]*?public\s+static\s+void\s+main)/, '$1Main$2');
          }
          
          const res = await axios.post('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
              source_code: sourceCode,
              language_id: JUDGE0_LANG_MAP[effectiveLang],
              stdin: stdinRef.current || ''
          });
          
          if (res.data) {
              const runDetails = res.data;
              if (runDetails.compile_output) {
                  setOutput(`Compilation Error:\n${runDetails.compile_output}`);
              } else if (runDetails.stderr) {
                  setOutput(`Error:\n${runDetails.stderr}\n\nOutput:\n${runDetails.stdout || ''}`);
              } else {
                  setOutput(runDetails.stdout || 'Program executed successfully with no output.');
              }
          } else {
              setOutput('Failed to execute code. Invalid response from Judge0 API.');
          }
      } catch (err) {
          console.error("Execution error:", err);
          setOutput(`Execution Failed: ${err.response?.data?.error || err.message}`);
      } finally {
          setIsExecuting(false);
      }
  };

  try {
      return (
        <div className="room-container">
          {/* Header */}
          <header className="room-header">
            <div className="room-info">
              <h2>Room: {roomId} <span className="pin-badge">PIN: {pin}</span></h2>
              <button 
                  onClick={() => {
                      navigator.clipboard.writeText(`Join my DSA Study Room!\nRoom ID: ${roomId}\nPIN: ${pin}`);
                      alert('Copied to clipboard!');
                  }} 
                  className="secondary-btn small"
                  title="Copy Invite Details"
              >
                  📋 Copy Invite
              </button>
              <div className="role-badge" style={{ marginLeft: '1rem' }}>
                 Your Role: <strong>{isCurrentEditor ? 'Editor' : role}</strong>
              </div>
            </div>
            <div className="header-actions">
               {isCurrentEditor ? (
                   <div className="requests-dropdown">
                      {controlRequests.length > 0 && <span className="notification-dot"></span>}
                      <button className="secondary-btn dropdown-anchor">Control Requests ({controlRequests.length})</button>
                      {controlRequests.length > 0 && (
                          <div className="dropdown-menu">
                             {controlRequests.map((req, idx) => (
                                 <div key={idx} className="request-item">
                                     <span>{req.username} wants to edit</span>
                                     <button onClick={() => grantControl(req.requesterSocketId)} className="primary-btn small">Grant</button>
                                 </div>
                             ))}
                          </div>
                      )}
                   </div>
               ) : (
                   <button onClick={requestControl} className="secondary-btn">Request Edit Control</button>
               )}
               <button onClick={() => navigate('/')} className="danger-btn ml-4">Leave Room</button>
            </div>
          </header>
    
          <div className="room-main">
            {/* Question Area */}
            {question && (
                <div className="question-section">
                    <div className="q-header">
                        <span className={`difficulty badge-${question.difficulty?.toLowerCase() || 'medium'}`}>
                            {question.difficulty || 'Medium'}
                        </span>
                    </div>
                    <h3>{question.title}</h3>
                    <div className="q-desc-full">{question.description}</div>
                    <div className="q-tags">
                        {question.tags?.map(tag => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                </div>
            )}
            
            {/* Editor Area */}
            <div className="editor-section">
               <div className="editor-toolbar">
                  <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
                      <select 
                         value={language} 
                         onChange={(e) => handleLanguageChange(e.target.value)} 
                         className="lang-select"
                         disabled={!isCurrentEditor}
                      >

                         <option value="python">Python</option>
                         <option value="java">Java</option>
                         <option value="c">C</option>
                         <option value="cpp">C++</option>
                      </select>
                      {!isCurrentEditor && <span className="readonly-warning">Read-Only Mode</span>}
                  </div>
                  <button 
                     id="run-btn"
                     onClick={runCode} 
                     disabled={isExecuting} 
                     className="primary-btn small" 
                     style={{backgroundColor: '#10b981', color:'white', border:'none', filter: isExecuting ? 'opacity(0.6)' : 'none'}}
                  >
                     {isExecuting ? 'Running...' : '▶ Run Code'}
                  </button>
               </div>
               <div className="editor-wrapper" style={{display:'flex', flexDirection:'column', height:'100%'}}>
                  <div style={{flex: 1}}>
                      <Editor
                         height="100%"
                         language={language}
                         theme="vs-dark"
                         value={code}
                         onChange={handleCodeChange}
                         options={{
                            readOnly: !isCurrentEditor,
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            suggestOnTriggerCharacters: true,
                            quickSuggestions: true,
                            formatOnType: true,
                         }}
                      />
                  </div>
                   {/* Terminal Panel */}
                  <div style={{height:'250px', flexShrink:0, display:'flex', flexDirection:'column', background:'#0d1117', borderTop:'1px solid #30363d', fontFamily:"'Fira Code','Consolas',monospace"}}>
                      {/* Top bar */}
                      <div style={{display:'flex', alignItems:'center', padding:'0 14px', height:'34px', background:'#161b22', borderBottom:'1px solid #30363d', gap:'8px'}}>
                          <span style={{width:12, height:12, borderRadius:'50%', background:'#ff5f57', display:'inline-block'}}/>
                          <span style={{width:12, height:12, borderRadius:'50%', background:'#febc2e', display:'inline-block'}}/>
                          <span style={{width:12, height:12, borderRadius:'50%', background:'#28c840', display:'inline-block'}}/>
                          <span style={{fontSize:'0.72rem', color:'#8b949e', marginLeft:'8px'}}>bash — judge0</span>
                          <button
                              onClick={() => { setOutput(''); setStdin(''); }}
                              style={{marginLeft:'auto', background:'none', border:'1px solid #30363d', borderRadius:'4px', color:'#8b949e', cursor:'pointer', fontSize:'0.7rem', padding:'2px 8px'}}
                          >clear</button>
                      </div>
                      {/* stdin row */}
                      <div style={{
                          display:'flex', alignItems:'flex-start', borderBottom:'1px solid #21262d',
                          padding:'6px 14px', gap:'8px', flexShrink:0,
                          background: !stdin.trim() && /input\(|Scanner|cin\s*>>|scanf\s*\(/.test(code) ? '#0d2117' : 'transparent',
                          borderLeft: !stdin.trim() && /input\(|Scanner|cin\s*>>|scanf\s*\(/.test(code) ? '3px solid #3fb950' : '3px solid transparent',
                      }}>
                          <span style={{color:'#3fb950', fontSize:'0.85rem', userSelect:'none', paddingTop:'2px'}}>$</span>
                          <textarea
                              value={stdin}
                              onChange={(e) => { setStdin(e.target.value); stdinRef.current = e.target.value; }}
                              placeholder={'Type program input here...\ne.g. John\n     25'}
                              rows={2}
                              style={{
                                  flex:1, background:'transparent', border:'none', outline:'none',
                                  color:'#e6edf3', fontFamily:'inherit', fontSize:'0.85rem',
                                  resize:'none', lineHeight:1.6
                              }}
                          />
                          <span style={{fontSize:'0.65rem', color:'#3fb950', opacity:0.5, paddingTop:'4px', whiteSpace:'nowrap'}}>stdin</span>
                      </div>
                      {/* output */}
                      <div style={{flex:1, overflowY:'auto', padding:'10px 14px'}}>
                          {isExecuting && <span style={{color:'#3fb950', fontSize:'0.82rem'}}>⟳ running...</span>}
                          {!output && !isExecuting && <span style={{color:'#484f58', fontSize:'0.82rem'}}>// output will appear here</span>}
                          {output && output.includes('EOFError') && (
                              <div style={{color:'#febc2e', fontSize:'0.78rem', marginBottom:'8px', padding:'4px 8px', background:'#2d2211', borderRadius:'4px', borderLeft:'3px solid #febc2e'}}>
                                  ↑ Your program needs input. Type it in the $ field above, then run again.
                              </div>
                          )}
                          {output && (
                              <pre style={{margin:0, fontSize:'0.85rem', lineHeight:1.7, whiteSpace:'pre-wrap',
                                  color: output.startsWith('Error') || output.startsWith('Compilation') ? '#f85149' : '#e6edf3'}}>
                                  {output}
                              </pre>
                          )}
                      </div>
                  </div>
               </div>
            </div>
    
            {/* Sidebar: Participants & Chat */}
            <div className="room-sidebar">
              
              <div className="participants-panel">
                <h3>Participants ({participants.length})</h3>
                <ul className="participants-list">
                   {participants.map((p, index) => (
                      <li key={index} className={p.socketId === editorId ? 'is-editor' : ''}>
                         <div className="user-avatar">{p.username.charAt(0).toUpperCase()}</div>
                         <span className="user-name">{p.username} {p.socketId === socket?.id && '(You)'}</span>
                         {p.socketId === editorId && <span className="editor-icon" title="Current Editor">✏️</span>}
                      </li>
                   ))}
                </ul>
              </div>
    
              <div className="chat-panel">
                <h3>Room Chat</h3>
                <div className="chat-messages">
                   {chat.map((c, i) => (
                       <div key={i} className={`chat-message ${c.username === user.username ? 'my-message' : ''}`}>
                           <span className="chat-sender">{c.username}</span>
                           <p className="chat-text">{c.message}</p>
                       </div>
                   ))}
                </div>
                <form onSubmit={handleSendMessage} className="chat-input-form">
                   <input 
                      type="text" 
                      value={message} 
                      onChange={(e) => setMessage(e.target.value)} 
                      placeholder="Type a message..."
                   />
                   <button type="submit">Send</button>
                </form>
              </div>
    
            </div>
          </div>
        </div>
      );
  } catch (err) {
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
            <h1>React Component Crash!</h1>
            <pre>{err.message}</pre>
            <pre>{err.stack}</pre>
        </div>
      );
  }
};

export default Room;
