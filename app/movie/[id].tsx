import { useLocalSearchParams } from 'expo-router';
import DetailsScreen from '../../src/screens/details/DetailsScreen';

export default function MovieDetail() {
  const { id } = useLocalSearchParams();
  return <DetailsScreen route={{ params: { id } }} />;
}
