import { runConnectionFlow, type ConnectionFlowContext } from '../../../../shared/realtime/runConnectionFlow'

export type ConnectionFlowRunner = (context: ConnectionFlowContext, myOp: number) => Promise<void>

export interface AttemptConnectionOptions {
  myOp: number
  createContext: () => ConnectionFlowContext
  runFlow?: ConnectionFlowRunner
}

export async function attemptConnection({
  myOp,
  createContext,
  runFlow = runConnectionFlow,
}: AttemptConnectionOptions): Promise<void> {
  const context = createContext()
  await runFlow(context, myOp)
}
