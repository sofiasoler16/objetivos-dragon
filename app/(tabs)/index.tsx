import { StyleSheet, Text, View } from 'react-native';

export default function HoyScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hoy</Text>
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
