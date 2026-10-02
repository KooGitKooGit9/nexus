import { Route, Routes, useParams } from 'react-router-dom'
import { WorkflowsList } from './views/WorkflowsList'
import { WorkflowEditor } from './views/WorkflowEditor'

function EditorRoute() {
  const { id = '' } = useParams()
  return <WorkflowEditor id={id} />
}

export default function WorkflowsPage() {
  return (
    <Routes>
      <Route index element={<WorkflowsList />} />
      <Route path=":id" element={<EditorRoute />} />
      <Route path="*" element={<WorkflowsList />} />
    </Routes>
  )
}
