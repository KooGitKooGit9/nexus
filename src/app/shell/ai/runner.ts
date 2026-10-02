/**
 * Gemini agent loop:
 *   user message → generate → (functionCalls? → run tools → functionResponses → generate …) → final text
 *
 * The model's turns are appended to `contents` exactly as returned (thought signatures included) and
 * every round's function calls are answered in one user turn, same order, same ids.
 */
import { uid } from '@/lib/utils'
import { GeminiError, compactResult, functionCallsOf, functionResponseTurn, generate, trimContents, visibleText, type Content, type FunctionCall, type GenerateRequest, type GenerateResult } from './gemini'
import { validateArgs } from './schema'
import { buildSystemPrompt } from './prompt'
import { FUNCTION_DECLARATIONS, getTool, promptContext, stepLabel, toolErrorMessage, type ActionCardData, type ConfirmPreview } from './tools'

export interface ToolStep {
  id: string
  name: string
  label: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  error?: string
}

export interface ConfirmRequest {
  stepId: string
  tool: string
  preview: ConfirmPreview
}

export interface ConfirmResult {
  ok: boolean
  /** edited body text */
  text?: string
}

export interface RunHooks {
  onStep: (step: ToolStep) => void
  onCard: (card: ActionCardData) => void
  /** history changed (model turn or function responses appended) */
  onContents: (contents: Content[]) => void
  /** text the model produced so far (it may talk before/between tool calls) */
  onInterim?: (text: string) => void
  confirm: (req: ConfirmRequest) => Promise<ConfirmResult>
  navigate: (path: string) => void
}

export interface RunOptions {
  signal: AbortSignal
  confirmBeforeSend: boolean
  hooks: RunHooks
}

export const MAX_ROUNDS = 8

async function execute(call: FunctionCall, opts: RunOptions): Promise<Record<string, unknown>> {
  const { hooks } = opts
  const step: ToolStep = { id: uid('step'), name: call.name, label: stepLabel(call.name, call.args ?? {}), status: 'running' }
  hooks.onStep(step)
  const finish = (status: ToolStep['status'], error?: string) => hooks.onStep({ ...step, status, error })

  const tool = getTool(call.name)
  if (!tool) {
    finish('error', '알 수 없는 도구')
    return { error: `알 수 없는 도구입니다: ${call.name}` }
  }
  const v = validateArgs(tool.decl.parameters, call.args)
  if (!v.ok) {
    finish('error', v.error)
    return { error: `잘못된 인자: ${v.error}` }
  }
  let args = v.args

  if (tool.outbound && tool.preview && opts.confirmBeforeSend) {
    let preview: ConfirmPreview
    try {
      preview = tool.preview(args)
    } catch (err) {
      const msg = toolErrorMessage(err)
      finish('error', msg)
      return { error: msg }
    }
    const answer = await hooks.confirm({ stepId: step.id, tool: call.name, preview })
    if (!answer.ok) {
      finish('cancelled')
      return { cancelled: true, message: '사용자가 확인 카드에서 실행을 취소했습니다. 다시 시도하지 말고 취소되었다고만 알려주세요.' }
    }
    if (answer.text !== undefined) args = { ...args, [preview.textKey]: answer.text }
  }

  try {
    const out = tool.run(args, { navigate: hooks.navigate })
    if (out.card) hooks.onCard(out.card)
    finish('done')
    return compactResult(out.result)
  } catch (err) {
    const msg = toolErrorMessage(err)
    finish('error', msg)
    return { error: msg }
  }
}

/**
 * Runs the loop on `history` (which must already end with the new user turn).
 * Throws GeminiError (NO_KEY, RATE_LIMIT, ABORTED, …).
 */
export async function runGemini(history: Content[], opts: RunOptions): Promise<{ text: string; contents: Content[]; usedTools: boolean }> {
  const { signal, hooks } = opts
  const system = buildSystemPrompt(promptContext(opts.confirmBeforeSend))
  let contents = history
  const texts: string[] = []
  let usedTools = false
  let malformedRetried = false

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    if (signal.aborted) throw new GeminiError('ABORTED', 'aborted')
    const last = round === MAX_ROUNDS
    const req: GenerateRequest = {
      contents: trimContents(contents),
      systemInstruction: { parts: [{ text: system }] },
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      // last round: force a text answer so the loop always ends with words
      toolConfig: { functionCallingConfig: { mode: last ? 'NONE' : 'AUTO' } },
    }
    let res: GenerateResult
    try {
      res = await generate(req, signal)
    } catch (err) {
      if (err instanceof GeminiError && err.code === 'MALFORMED' && !malformedRetried) {
        malformedRetried = true
        round--
        continue
      }
      throw err
    }

    contents = [...contents, res.content]
    hooks.onContents(contents)
    const t = visibleText(res.content)
    if (t) {
      texts.push(t)
      hooks.onInterim?.(texts.join('\n\n'))
    }

    const calls = functionCallsOf(res.content)
    if (!calls.length) break
    usedTools = true
    const results: Record<string, unknown>[] = []
    for (const call of calls) results.push(await execute(call, opts))
    contents = [...contents, functionResponseTurn(calls, results)]
    hooks.onContents(contents)
  }

  if (signal.aborted) throw new GeminiError('ABORTED', 'aborted')
  return { text: texts.join('\n\n'), contents, usedTools }
}
