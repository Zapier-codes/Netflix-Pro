import { useLocalSearchParams } from 'expo-router';
import VideoPlayerScreen from '../../src/screens/player/VideoPlayerScreen';

export default function VideoPlayer() {
  const { id } = useLocalSearchParams();
  return <VideoPlayerScreen route={{ params: { id } }} />;
}
