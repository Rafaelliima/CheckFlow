import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Analysis, AnalysisItem } from '../types';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 18, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  section: { marginBottom: 15 },
  title: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  text: { marginBottom: 3 },
  table: { 
    display: 'flex', 
    flexDirection: 'column', 
    width: '100%', 
    borderStyle: 'solid', 
    borderWidth: 1, 
    borderRightWidth: 0, 
    borderBottomWidth: 0 
  },
  tableRow: { flexDirection: 'row' },
  tableColHeader: { 
    width: '20%', 
    borderStyle: 'solid', 
    borderWidth: 1, 
    borderLeftWidth: 0, 
    borderTopWidth: 0, 
    backgroundColor: '#f9fafb', 
    padding: 5 
  },
  tableCol: { 
    width: '20%', 
    borderStyle: 'solid', 
    borderWidth: 1, 
    borderLeftWidth: 0, 
    borderTopWidth: 0, 
    padding: 5 
  },
  tableCellHeader: { fontSize: 10, fontWeight: 'bold' },
  tableCell: { fontSize: 9 }
});

interface Props {
  analysis: Analysis;
  items: AnalysisItem[];
}

export const AnalysisPDF = ({ analysis, items }: Props) => {
  const totalItems = items.length;
  const okItems = items.filter(i => i.status === 'OK').length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Relatório de Análise</Text>
        
        <View style={styles.section}>
          <Text style={styles.text}>Arquivo: {analysis.file_name}</Text>
          <Text style={styles.text}>Data: {new Date(analysis.created_at).toLocaleDateString('pt-BR')} às {new Date(analysis.created_at).toLocaleTimeString('pt-BR')}</Text>
          <Text style={styles.text}>Total de Itens: {totalItems}</Text>
          <Text style={styles.text}>Itens OK: {okItems}</Text>
        </View>

        {analysis.notes && (
          <View style={styles.section}>
            <Text style={styles.title}>Notas Gerais:</Text>
            <Text style={styles.text}>{analysis.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.title}>Itens Verificados:</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Tag</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Descrição</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Patrimônio</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Nº Série</Text></View>
              <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Status</Text></View>
            </View>
            {items.map(item => (
              <View style={styles.tableRow} key={item.id}>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.tag}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.descricao}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.patrimonio}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.numero_serie}</Text></View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.status}</Text></View>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
};
