import { StyleSheet, Text, View } from 'react-native';

export default function ProgresoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Progreso</Text>
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
