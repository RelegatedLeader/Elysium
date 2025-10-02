import React, { useState } from 'react';

const APITest: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const testAPI = async () => {
    setIsTesting(true);
    setTestResult('Testing API key and models...\n');

    const apiKey = process.env.REACT_APP_MISTRAL_API_KEY;

    if (!apiKey) {
      setTestResult('❌ No Mistral AI API key found in environment variables');
      setIsTesting(false);
      return;
    }

    setTestResult(prev => prev + `✅ Mistral AI API key found: ${apiKey.substring(0, 20)}...\n\n`);

    const models = [
      'mistral-tiny',        // Fast and free
      'mistral-small',       // Good balance of speed/quality
      'mistral-medium',      // More capable
      'mistral-large-latest' // Most capable (still free tier)
    ];

    for (const model of models) {
      try {
        setTestResult(prev => prev + `🔄 Testing ${model}...\n`);

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: 'user',
              content: 'Say "Hello from Elysium test!" and nothing else.'
            }],
            max_tokens: 50,
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          setTestResult(prev => prev + `✅ ${model}: ${content}\n\n`);
        } else {
          const errorText = await response.text();
          setTestResult(prev => prev + `❌ ${model}: ${response.status} - ${errorText}\n\n`);
        }
      } catch (error) {
        setTestResult(prev => prev + `💥 ${model}: ${error instanceof Error ? error.message : String(error)}\n\n`);
      }
    }

    setTestResult(prev => prev + 'Test completed.');
    setIsTesting(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h2>Mistral AI API Test</h2>
      <button onClick={testAPI} disabled={isTesting}>
        {isTesting ? 'Testing...' : 'Test API Key & Models'}
      </button>
      <div style={{
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {testResult}
      </div>
    </div>
  );
};

export default APITest;