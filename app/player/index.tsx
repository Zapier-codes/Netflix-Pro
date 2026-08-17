import { useLocalSearchParams } from 'expo-router';
import VideoPlayerScreen from '../../src/screens/player/VideoPlayerScreen';

export default function VideoPlayer() {
  const params = useLocalSearchParams();
  
  // Log all params for debugging
  console.log('[PlayerRoute] All params received:', JSON.stringify(params, null, 2));
  
  // Pass ALL params to the VideoPlayerScreen
  return <VideoPlayerScreen route={{ params }} />;
}