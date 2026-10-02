import { useParams } from 'react-router-dom'
import { DirectoryView } from './views/DirectoryView'
import { ProfilePage } from './views/ProfilePage'

/** Mounted at `/people/*` — `/people` directory (tabs via ?tab=), `/people/:userId` profile. */
export default function PeoplePage() {
  const rest = useParams()['*'] ?? ''
  const userId = rest.split('/')[0]
  if (userId) return <ProfilePage userId={userId} />
  return <DirectoryView />
}
