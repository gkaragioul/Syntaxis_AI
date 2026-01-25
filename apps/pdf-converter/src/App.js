import React, { useState, useRef } from 'react';

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle', 'converting', 'completed'
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const fileInputRef = useRef(null);

  // --- Logger Helper ---
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev]);
  };

  // --- Event Handlers for Drag & Drop visuals ---
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    addLog('Drag enter detected');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addLog('Drag leave detected');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addLog('File dropped');
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      const droppedFile = files[0];
      setFile(droppedFile);
      addLog(`File accepted: ${droppedFile.name} (${(droppedFile.size / 1024).toFixed(2)} KB)`);
      // Reset status on new file drop
      setStatus('idle');
      setProgress(0);
    } else {
      addLog('Drop rejected: No valid PDF file found');
      alert("Please drop a PDF file.");
    }
  };

  const handleClickUpload = () => {
    addLog('Upload area clicked');
    fileInputRef.current.click();
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      addLog(`File selected via dialog: ${selectedFile.name}`);
       // Reset status on new file selection
      setStatus('idle');
      setProgress(0);
    } else {
      addLog('File dialog closed without selection');
    }
  };

  // --- Real Conversion Handler ---
  const handleConvert = async () => {
    if (!file) {
      addLog('Convert clicked but no file selected');
      return;
    }
    
    addLog('Starting conversion process...');
    setStatus('converting');
    setProgress(10);
    addLog(`Uploading ${file.name} to backend...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Changed to point to our new local server.js
        const response = await fetch('http://localhost:3001/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Upload failed');
        }

        const data = await response.json();
        addLog(`Upload successful: ${JSON.stringify(data.data)}`);
        
        // Simulate processing after upload
        setProgress(50);
        addLog('Processing file on backend...');
        
        // Mocking the completion of "conversion" since the backend just echoed success
        setTimeout(() => {
            setProgress(100);
            setStatus('completed');
            addLog('Conversion completed successfully!');
        }, 1500);

    } catch (error) {
        console.error('Conversion error:', error);
        addLog(`Error: ${error.message}`);
        setStatus('idle'); // Reset to idle on error to allow retry
        setProgress(0);
        alert(`Conversion failed: ${error.message}. Is the backend running on port 3001?`);
    }
  };

  // --- Logs Handlers ---
  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    addLog('Logs copied to clipboard');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  // --- Download Handler ---
  const handleDownload = () => {
    addLog('Generating mock CSV file...');
    
    // Mock Data for the CSV
    const csvContent = [
      ["Invoice Number", "Date", "Total Amount", "Vendor"],
      ["INV-001", "2023-04-01", "$1,500.00", "Acme Corp"],
      ["INV-002", "2023-04-15", "$2,300.50", "Global Supplies"],
      ["INV-003", "2023-04-20", "$500.00", "Local Services"]
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `converted_${file ? file.name.replace('.pdf', '') : 'data'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLog('CSV download initiated.');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans relative">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
        
        {/* Title */}
        <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">
          PDF to Excel Converter
        </h1>

        {/* Upload Area */}
        <div
          onClick={handleClickUpload}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-200 ease-in-out
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
            ${file ? 'bg-blue-50/50 border-blue-200' : ''}
          `}
        >
          <input 
            type="file" 
            accept="application/pdf" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          
          {/* Cloud Upload Icon SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-400 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>

          <p className="text-gray-600 text-lg">
            {file ? `Selected: ${file.name}` : "Drag and Drop PDF here or Click to Upload"}
          </p>
        </div>

        {/* Convert Button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleConvert}
            disabled={!file || status === 'converting'}
            className="px-10 py-3 bg-blue-600 text-white rounded-md font-medium text-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'converting' ? 'Converting...' : 'Convert'}
          </button>
        </div>

        {/* Conversion Status Section */}
        {/* We show this section regardless of state to match the image, but you might conditionally render it in a real app */}
        <div className="mt-10 border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-gray-800">Conversion Status</h2>
            
            {status === 'completed' && (
              <button 
                onClick={handleDownload}
                className="flex items-center text-blue-600 hover:text-blue-800 transition"
              >
                {/* Download Icon SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Excel (CSV)
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              // Fix: 70% was hardcoded for demo purposes in the original code, confusing the user.
              // Now it correctly reflects 0 when idle, and progress when converting.
              style={{ width: `${status === 'converting' ? progress : (status === 'completed' ? 100 : 0)}%` }} 
            ></div>
          </div>
        </div>

      </div>

      {/* Logs Controls */}
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={() => setShowLogs(!showLogs)}
          className="bg-gray-800 text-white px-4 py-2 rounded shadow-md hover:bg-gray-700 text-sm"
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>
      </div>

      {/* Logs Window */}
      {showLogs && (
        <div className="fixed bottom-4 right-4 w-96 h-96 bg-gray-900 text-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden text-sm border border-gray-700 z-50">
          <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700">
            <span className="font-semibold">Application Logs</span>
            <div className="flex space-x-2">
              <button 
                onClick={copyLogs} 
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
              >
                Copy
              </button>
              <button 
                onClick={clearLogs} 
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto font-mono">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic text-center mt-10">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 break-words">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
