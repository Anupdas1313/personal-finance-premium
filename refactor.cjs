const fs = require('fs');
let code = fs.readFileSync('src/components/AIChatEntry.tsx', 'utf-8');

// 1. Add import
if (!code.includes('parseTransactionWithAI')) {
  code = code.replace(
    /import \{ useCurrency \} from '\.\.\/hooks\/useCurrency';/,
    "import { useCurrency } from '../hooks/useCurrency';\nimport { parseTransactionWithAI, ParsedTransaction } from '../lib/gemini';"
  );
}

// 2. Remove EMOJI_CATEGORY, EMOJI_TAG, MERCHANT_KNOWLEDGE
code = code.replace(/\/\/ ─── Emoji → Category Shortcuts[\s\S]*?\/\/ ─── Date Parsing/m, '// ─── Date Parsing');

// 3. Remove parseUniversal
code = code.replace(/\/\/ ─── Universal Parser ────────────────────────────────────────────────────[\s\S]*?\/\/ ─── Personal Learning Hook/m, '// ─── Personal Learning Hook');

// 4. Remove usePersonalLearning
code = code.replace(/\/\/ ─── Personal Learning Hook ───────────────────────────────────────────────[\s\S]*?\/\/ ─── Main Component/m, '// ─── Main Component');

// 5. Remove usePersonalLearning invocation
code = code.replace(/const \{ recentTx, smartDefaults, payeeMemory \} = usePersonalLearning\(\);\n/, '');

// 6. Rewrite checkNextStep smartDefaults logic
code = code.replace(/if \(smartDefaults\.accountId\) \{[\s\S]*?\} else addAIMessage\(prompt, options\);/, 'addAIMessage(prompt, options);');
code = code.replace(/if \(smartDefaults\.paymentMethod\) \{[\s\S]*?\} else \{ setStage\('ASK_PAYMENT_METHOD'\); addAIMessage\("How did you pay\?", methods\); \}/, 'setStage(\'ASK_PAYMENT_METHOD\'); addAIMessage("How did you pay?", methods);');
code = code.replace(/if \(smartDefaults\.upiApp\) \{[\s\S]*?\} else \{ setStage\('ASK_UPI_APP'\); addAIMessage\("Which UPI app\?", upiApps\); \}/, 'setStage(\'ASK_UPI_APP\'); addAIMessage("Which UPI app?", upiApps);');

// 7. Rewrite applyParsed
const applyParsedReplacement = `const applyParsed = (p: ParsedTransaction, updated: any) => {
    const isDebit = p.type === 'DEBIT' || updated.type === 'DEBIT';
    const newTx = {
      ...updated,
      ...(p.amount && { amount: p.amount }),
      ...(p.type && { type: p.type }),
      ...(p.accountId && { selectedAccountId: p.accountId }),
      ...(p.toAccountId && { toAccountId: p.toAccountId }),
      ...(p.paymentMethod && !updated.paymentMethod && { paymentMethod: p.paymentMethod }),
      ...(p.upiApp && { upiApp: p.upiApp }),
      ...(p.category && { category: p.category }),
      ...(p.tag && { expenseType: p.tag }),
      ...(p.party && { party: p.party }),
      ...(p.note && { note: p.note }),
      linkedBudgetId: isDebit ? undefined : null,
      _dateConfirmed: true,
      _isPredicted: false,
      _confidence: 95,
    };
    setPendingTx(newTx);
    checkNextStep(newTx);
  };`;
code = code.replace(/const applyParsed = \([\s\S]*?checkNextStep\(newTx\);\n  \};/m, applyParsedReplacement);

// 8. Remove the old handleSend logic and replace with the new Gemini one
const handleSendReplacement = `const handleSend = useCallback(async (msgOverride?: string) => {
    const userMsg = (msgOverride || input).trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setAutocomplete([]);

    let updated = { ...pendingTx };
    const t = userMsg.toLowerCase();
    
    // Chat-based Undo / Delete
    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const deleteMatch = t.match(/^(?:undo|delete|remove)\\s*(.*)$/i);
      if (deleteMatch) {
        const target = deleteMatch[1].trim();
        setIsTyping(true);
        setTimeout(async () => {
          if (!target || target === 'last' || target === 'that' || target === 'it' || target === 'transaction') {
            const last = await db.transactions.orderBy('dateTime').reverse().first();
            if (last && last.id) {
              if (last.linkedTransactionId) await db.transactions.delete(last.linkedTransactionId);
              await db.transactions.delete(last.id);
              setMessages(prev => [...prev, { role: 'ai', content: \`🗑️ Deleted your last transaction (\${currency}\${last.amount}).\` }]);
              handleReset();
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: \`Hmm, I couldn't find any recent transaction to delete.\` }]);
            }
          } else {
            const recentMatches = await db.transactions
              .filter(tx => 
                (tx.party?.toLowerCase().includes(target) || false) || 
                (tx.category?.toLowerCase().includes(target) || false) ||
                (tx.note?.toLowerCase().includes(target) || false)
              ).toArray();
            
            if (recentMatches.length > 0) {
              recentMatches.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
              const match = recentMatches[0];
              if (match.id) {
                if (match.linkedTransactionId) await db.transactions.delete(match.linkedTransactionId);
                await db.transactions.delete(match.id);
                setMessages(prev => [...prev, { role: 'ai', content: \`🗑️ Deleted recent transaction matching "\${target}".\` }]);
                handleReset();
              }
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: \`I couldn't find any recent transactions matching "\${target}" to delete.\` }]);
            }
          }
          setIsTyping(false);
        }, 600);
        return;
      }
    }

    if (t.match(/^(same|repeat|again|same as last)$/i)) {
      const last = await db.transactions.orderBy('dateTime').reverse().first();
      if (last) {
        const cloned = {
          ...pendingTx,
          amount: last.amount, type: last.type, selectedAccountId: last.accountId,
          paymentMethod: last.paymentMethod, upiApp: last.upiApp || '',
          category: last.category, expenseType: last.expenseType || '', party: last.party || '',
          note: last.note, transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          linkedBudgetId: last.linkedBudgetId,
          _dateConfirmed: true, _isPredicted: false, _confidence: 90
        };
        setPendingTx(cloned);
        setStage('PREVIEW');
        addAIMessage(\`♻️ Copied last entry: \${currency}\${last.amount} — \${last.note || 'No note'}\\nReview and save!\`);
        return;
      } else {
        addAIMessage("No previous transactions found yet. Tell me about your expense!");
        return;
      }
    }

    if (stage === 'PREVIEW') {
      if (handleCorrectionCommand(userMsg, updated)) return;
    }

    if (stage === 'IDLE' && !t.match(/^(edit|change|update)/)) {
      setIsTyping(true);
      try {
        const parsedArray = await parseTransactionWithAI(userMsg, { accounts, categories: appCategories, tags });
        if (parsedArray && parsedArray.length > 0) {
          if (parsedArray.length > 1) {
            addAIMessage(\`📋 Found \${parsedArray.length} transactions! Processing one by one...\`);
            // Queue the rest by re-converting them to strings for simplicity, or just apply the first
            setMultiQueue(parsedArray.slice(1).map(tx => JSON.stringify(tx)));
          }
          applyParsed(parsedArray[0], updated);
        } else {
          addAIMessage("I couldn't understand that. Could you provide the amount and what it was for?");
        }
      } catch (e) {
        console.error(e);
        addAIMessage("Oops, AI parsing failed. Please check your connection or enter manually.");
      } finally {
        setIsTyping(false);
      }
    } else if (stage === 'ASK_AMOUNT') {
      const amt = parseAmount(userMsg);
      if (amt && !isNaN(parseFloat(amt))) { updated.amount = parseFloat(amt); setPendingTx(updated); checkNextStep(updated); }
      else addAIMessage("Hmm, try: 500, 2k, \${currency}250");
    } else if (stage === 'ASK_TYPE') {
      if (t.match(/\\b(transfer|move|send|🔄)\\b/)) updated.type = 'TRANSFER';
      else if (t.match(/\\b(income|inflow|received|credit|salary|💰)\\b/)) updated.type = 'CREDIT';
      else updated.type = 'DEBIT';
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_PAYEE') {
      if (t.match(/^(skip|no|na|-)$/i)) {
        updated.party = '-';
      } else {
        updated.party = userMsg;
      }
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_CATEGORY') {
      const catOverride = userMsg.match(/^\\[(.*)\\]$/);
      const cat = appCategories.find(c => c.toLowerCase().includes(catOverride ? catOverride[1].toLowerCase() : userMsg.toLowerCase()));
      if (cat) updated.category = cat;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_BANK') {
      const acc = accounts.find(a => a.bankName.toLowerCase().includes(userMsg.toLowerCase()));
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId) updated.toAccountId = acc.id;
        else updated.selectedAccountId = acc.id;
      }
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_PAYMENT_METHOD') {
      updated.paymentMethod = userMsg;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_UPI_APP') {
      updated.upiApp = userMsg;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_TAG') {
      const tg = tags.find(t => t.toLowerCase().includes(userMsg.toLowerCase()));
      if (tg) updated.expenseType = tg;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_NOTE') {
      if (!t.match(/^(skip|no|na|-)$/i)) updated.note = userMsg;
      else updated.note = '-';
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_DATE') {
      const { date } = parseDate(userMsg);
      if (date) updated.transactionDate = date;
      updated._dateConfirmed = true;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_BUDGET') {
      if (t !== 'none') {
        const selected = envelopeBudgets.find(b => b.category.toLowerCase().includes(t.toLowerCase()));
        if (selected) updated.linkedBudgetId = selected.id;
        else updated.linkedBudgetId = null;
      } else {
        updated.linkedBudgetId = null;
      }
      setPendingTx(updated); checkNextStep(updated);
    }
  }, [input, pendingTx, stage, accounts, tags, multiQueue, messages, appCategories, envelopeBudgets, currency]);`;

code = code.replace(/const handleSend = useCallback\(\(msgOverride\?: string\) => \{[\s\S]*?\}, \[input, pendingTx, stage, accounts, tags, recentTx, smartDefaults, payeeMemory, multiQueue, messages, appCategories, envelopeBudgets\]\);/m, handleSendReplacement);

// 9. Remove recentTx logic from dependencies of useEffect
code = code.replace(/\[messages, isTyping, recentTx\]/, '[messages, isTyping]');

// Save it back to AIChatEntry.tsx
fs.writeFileSync('src/components/AIChatEntry.tsx', code);
console.log('Successfully refactored AIChatEntry.tsx!');
