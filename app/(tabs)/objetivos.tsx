import { StyleSheet, Text, View } from 'react-native';

export default function ObjetivosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Objetivos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    opacity: 0.5,
  },
});
