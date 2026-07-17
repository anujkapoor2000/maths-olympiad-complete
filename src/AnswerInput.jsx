import React from 'react';
import { getAnswerInputConfig, sanitizeAnswerInput } from './answerCheck.js';

export default function AnswerInput({ question, value, onChange, onSubmit }) {
  const config = getAnswerInputConfig(question);

  const handleChange = (event) => {
    onChange(sanitizeAnswerInput(event.target.value, config.format));
  };

  return (
    <div className="answer-input-wrap">
      <input
        type="text"
        placeholder={config.placeholder}
        value={value}
        onChange={handleChange}
        onKeyPress={(event) => event.key === 'Enter' && onSubmit()}
        inputMode={config.inputMode}
        pattern={config.pattern || undefined}
        aria-describedby={`answer-hint-${question.id}`}
        autoComplete="off"
        spellCheck="false"
      />
      {config.hint && (
        <p className="answer-hint" id={`answer-hint-${question.id}`}>
          {config.hint}
        </p>
      )}
    </div>
  );
}
