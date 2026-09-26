/**
 * scriptFormatter.ts
 * Converts structured video data payloads into human-readable text and parses
 * user edits back into valid structured video data payloads.
 */

export function formatDataToHumanScript(data: any): string {
  if (!data || typeof data !== 'object') return '';

  const format = data.format || data.type;

  // 1. QUIZ
  if (format === 'Quiz' || Array.isArray(data.questions)) {
    const lines: string[] = [];
    if (data.script) {
      lines.push(`VOICEOVER HOOK:`);
      lines.push(data.script.trim());
      lines.push('');
    }

    const questions = data.questions || [];
    questions.forEach((q: any, i: number) => {
      lines.push(`[QUESTION ${i + 1}]`);
      lines.push(`Question: ${q.question || ''}`);
      const opts = Array.isArray(q.options) ? q.options.join(', ') : '';
      lines.push(`Options: ${opts}`);
      lines.push(`Answer: ${q.correct_answer || (q.options ? q.options[0] : '')}`);
      if (q.image_keyword) {
        lines.push(`Image: ${q.image_keyword}`);
      }
      if (q.show_image_first) {
        lines.push(`Show Image First: Yes`);
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  // 2. WOULD YOU RATHER
  if (format === 'Would You Rather' || Array.isArray(data.scenarios)) {
    const lines: string[] = [];
    const scenarios = data.scenarios || [];
    scenarios.forEach((s: any, i: number) => {
      lines.push(`[SCENARIO ${i + 1}]`);
      const pctA = s.percent_a !== undefined ? ` (${s.percent_a}%)` : '';
      const pctB = s.percent_b !== undefined ? ` (${s.percent_b}%)` : '';
      lines.push(`Option A: ${s.option_a || ''}${pctA}`);
      lines.push(`Option B: ${s.option_b || ''}${pctB}`);
      if (s.image_keyword_a || s.image_keyword_b) {
        lines.push(`Keywords: ${s.image_keyword_a || ''} | ${s.image_keyword_b || ''}`);
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  // 3. ARENA CLASH
  if (format === 'Arena Clash' || Array.isArray(data.contestants)) {
    const lines: string[] = [];
    if (data.script) {
      lines.push(`VOICEOVER HOOK:`);
      lines.push(data.script.trim());
      lines.push('');
    }

    const contestants = data.contestants || [];
    if (contestants.length > 0) {
      lines.push(`[CONTESTANTS]`);
      contestants.forEach((c: any, i: number) => {
        lines.push(`${i + 1}. ${c.name || 'Fighter'} (Color: ${c.color || '#ff0000'}, Health: ${c.starting_health || 100})`);
      });
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  // 4. DATA COMPARISON (Default)
  const lines: string[] = [];
  if (data.script) {
    lines.push(`VOICEOVER HOOK:`);
    lines.push(data.script.trim());
    lines.push('');
  }

  if (data.y_axis_label) {
    lines.push(`Metric: ${data.y_axis_label}`);
  }
  if (Array.isArray(data.timeline_labels) && data.timeline_labels.length > 0) {
    lines.push(`Timeline: ${data.timeline_labels.join(', ')}`);
  }
  lines.push('');

  const items = data.items || [];
  if (items.length > 0) {
    lines.push(`[DATA ITEMS]`);
    items.forEach((item: any) => {
      const vals = Array.isArray(item.values) ? item.values.join(', ') : '';
      lines.push(`${item.label || 'Item'}: ${vals}`);
    });
  }

  return lines.join('\n').trim();
}

export function parseHumanScriptToData(text: string, existingData: any): any {
  if (!text || typeof text !== 'string') return existingData;
  const data = JSON.parse(JSON.stringify(existingData || {}));
  const format = data.format || data.type;

  // 1. QUIZ PARSER
  if (format === 'Quiz' || Array.isArray(data.questions)) {
    // Extract Voiceover Hook
    const hookMatch = text.match(/(?:VOICEOVER\s*(?:HOOK|SCRIPT)?|SCRIPT)\s*:\s*([\s\S]*?)(?=\n\s*\[?QUESTION|\n\s*Q\d+|$)/i);
    if (hookMatch && hookMatch[1].trim()) {
      data.script = hookMatch[1].trim();
    }

    // Split text into question blocks
    const qBlocks = text.split(/(?=\n\s*\[?QUESTION\s*\d*\]?|\n\s*Q\d+\s*[:.])/i);
    const parsedQuestions: any[] = [];

    qBlocks.forEach((block) => {
      const trimmed = block.trim();
      if (!trimmed || /^(?:VOICEOVER|SCRIPT)/i.test(trimmed)) return;

      const qLineMatch = trimmed.match(/(?:Question|Q\d*)\s*[:.]\s*(.*)/i);
      const question = qLineMatch ? qLineMatch[1].trim() : '';

      const optLineMatch = trimmed.match(/Options?\s*[:.]\s*(.*)/i);
      let options: string[] = [];
      if (optLineMatch) {
        options = optLineMatch[1]
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const ansLineMatch = trimmed.match(/Answer\s*[:.]\s*(.*)/i);
      const answer = ansLineMatch ? ansLineMatch[1].trim() : (options[0] || '');

      const imgLineMatch = trimmed.match(/Image(?:\s*Keyword)?\s*[:.]\s*(.*)/i);
      const imageKeyword = imgLineMatch ? imgLineMatch[1].trim() : '';

      const imgFirstMatch = trimmed.match(/(?:Show Image First|Image First)\s*[:.]\s*(.*)/i);

      if (question || options.length > 0) {
        const existingQ = (data.questions || [])[parsedQuestions.length] || {};
        const showImageFirst = imgFirstMatch 
          ? /yes|true|1/i.test(imgFirstMatch[1].trim())
          : existingQ.show_image_first;

        parsedQuestions.push({
          ...existingQ,
          question: question || existingQ.question || `Question ${parsedQuestions.length + 1}`,
          options: options.length >= 2 ? options : (existingQ.options || ['Option A', 'Option B', 'Option C']),
          correct_answer: answer || existingQ.correct_answer || options[0] || 'Option A',
          image_keyword: imageKeyword || existingQ.image_keyword || question.slice(0, 30),
          ...(showImageFirst !== undefined ? { show_image_first: showImageFirst } : {}),
        });
      }
    });

    if (parsedQuestions.length > 0) {
      data.questions = parsedQuestions;
    }
    return data;
  }

  // 2. WOULD YOU RATHER PARSER
  if (format === 'Would You Rather' || Array.isArray(data.scenarios)) {
    const sBlocks = text.split(/(?=\n\s*\[?SCENARIO\s*\d*\]?)/i);
    const parsedScenarios: any[] = [];

    sBlocks.forEach((block) => {
      const trimmed = block.trim();
      if (!trimmed) return;

      const optAMatch = trimmed.match(/Option\s*A\s*[:.]\s*([^(]+)(?:\((\d+)%?\))?/i);
      const optBMatch = trimmed.match(/Option\s*B\s*[:.]\s*([^(]+)(?:\((\d+)%?\))?/i);
      const kwMatch = trimmed.match(/Keywords?\s*[:.]\s*([^|\n]+)(?:\|([^\n]+))?/i);

      if (optAMatch && optBMatch) {
        const existingS = (data.scenarios || [])[parsedScenarios.length] || {};
        const optA = optAMatch[1].trim();
        const optB = optBMatch[1].trim();
        const pctA = optAMatch[2] ? parseInt(optAMatch[2], 10) : (existingS.percent_a || 50);
        const pctB = optBMatch[2] ? parseInt(optBMatch[2], 10) : (100 - pctA);

        const kwA = kwMatch ? kwMatch[1].trim() : (existingS.image_keyword_a || optA);
        const kwB = kwMatch && kwMatch[2] ? kwMatch[2].trim() : (existingS.image_keyword_b || optB);

        parsedScenarios.push({
          ...existingS,
          option_a: optA,
          option_b: optB,
          percent_a: pctA,
          percent_b: pctB,
          image_keyword_a: kwA,
          image_keyword_b: kwB,
        });
      }
    });

    if (parsedScenarios.length > 0) {
      data.scenarios = parsedScenarios;
    }
    return data;
  }

  // 3. ARENA CLASH PARSER
  if (format === 'Arena Clash' || Array.isArray(data.contestants)) {
    const hookMatch = text.match(/(?:VOICEOVER\s*(?:HOOK|SCRIPT)?|SCRIPT)\s*:\s*([\s\S]*?)(?=\n\s*\[?CONTESTANTS|\n\s*\d+\.|$)/i);
    if (hookMatch && hookMatch[1].trim()) {
      data.script = hookMatch[1].trim();
    }

    const fighterLines = text.match(/\d+\.\s*([^(]+)(?:\(([^)]+)\))?/g);
    if (fighterLines) {
      const parsedFighters: any[] = [];
      fighterLines.forEach((fl, idx) => {
        const m = fl.match(/\d+\.\s*([^(]+)(?:\(([^)]+)\))?/);
        if (m) {
          const name = m[1].trim();
          const meta = m[2] || '';
          const colorMatch = meta.match(/Color\s*[:.]\s*(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3})/i);
          const healthMatch = meta.match(/Health\s*[:.]\s*(\d+)/i);

          const existingC = (data.contestants || [])[idx] || {};
          parsedFighters.push({
            ...existingC,
            name: name || existingC.name || `Fighter ${idx + 1}`,
            color: colorMatch ? colorMatch[1] : (existingC.color || '#ff0000'),
            starting_health: healthMatch ? parseInt(healthMatch[1], 10) : (existingC.starting_health || 100),
            image_keyword: existingC.image_keyword || name,
          });
        }
      });
      if (parsedFighters.length > 0) {
        data.contestants = parsedFighters;
      }
    }
    return data;
  }

  // 4. DATA COMPARISON PARSER (Default)
  const hookMatch = text.match(/(?:VOICEOVER\s*(?:HOOK|SCRIPT)?|SCRIPT)\s*:\s*([\s\S]*?)(?=\n\s*Metric|\n\s*Timeline|\n\s*\[?DATA\s*ITEMS|$)/i);
  if (hookMatch && hookMatch[1].trim()) {
    data.script = hookMatch[1].trim();
  }

  const metricMatch = text.match(/Metric(?:\s*\(Y-Axis\))?\s*[:.]\s*([^\n]+)/i);
  if (metricMatch && metricMatch[1].trim()) {
    data.y_axis_label = metricMatch[1].trim();
  }

  const timelineMatch = text.match(/Timeline\s*[:.]\s*([^\n]+)/i);
  if (timelineMatch && timelineMatch[1].trim()) {
    data.timeline_labels = timelineMatch[1].split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }

  // Parse items: matches lines like "Apple: 900, 1200, 2000"
  const lines = text.split('\n');
  const parsedItems: any[] = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('VOICEOVER') || trimmed.startsWith('Metric') || trimmed.startsWith('Timeline') || trimmed.startsWith('[')) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const label = trimmed.slice(0, colonIdx).trim();
      const rawVals = trimmed.slice(colonIdx + 1).trim();
      const values = rawVals
        .split(/[, ]+/)
        .map((v) => parseFloat(v.replace(/[^0-9.-]/g, '')))
        .filter((v) => !isNaN(v));

      if (label && values.length > 0) {
        const existingItem = (data.items || [])[parsedItems.length] || {};
        parsedItems.push({
          ...existingItem,
          label: label || existingItem.label || `Item ${parsedItems.length + 1}`,
          image_keyword: existingItem.image_keyword || label,
          values: values,
        });
      }
    }
  });

  if (parsedItems.length > 0) {
    data.items = parsedItems;
  }

  return data;
}
