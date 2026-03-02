import { Board } from './components/Board';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <Board />
      <Toaster position="bottom-center" theme="dark" offset="80px" />
    </>
  );
}
