/* global notify */
import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Button, Col, Modal } from 'react-bootstrap';

import Select from 'react-select';
import { Table } from 'reactable';
import shortid from 'shortid';
// import { getExploreUrl } from '../../explore/exploreUtils';
import * as actions from '../actions';

import { t } from '../../locales';

const propTypes = {
  actions: PropTypes.object.isRequired,
  onHide: PropTypes.func,
  query: PropTypes.object,
  show: PropTypes.bool,
  datasource: PropTypes.string,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
};
const defaultProps = {
  show: false,
  query: {},
  onHide: () => {},
};

class ETLModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      etlName: this.etlName(),
      chunkSize: 1000,
      columns: this.getColumnFromProps(),
      hints: [],
    };
  }
  componentDidMount() {
    this.validate();
  }
  getColumnFromProps() {
    const props = this.props;
    if (!props ||
        !props.query ||
        !props.query.results ||
        !props.query.results.columns) {
      return {};
    }
    const columns = {};
    props.query.results.columns.forEach((col) => {
      columns[col.name] = col;
    });
    return columns;
  }
  etlName() {
    const { query } = this.props;
    const uniqueId = shortid.generate();
    let etlName = uniqueId;
    if (query) {
      etlName = query.db ? `${query.db}-` : '';
      etlName += query.user ? `${query.user}-` : '';
      etlName += `${uniqueId}`;
    }
    return etlName;
  }
  validate() {
    const hints = [];
    const cols = this.mergedColumns();
    const re = /^\w+$/;
    Object.keys(cols).forEach((colName) => {
      if (!re.test(colName)) {
        hints.push(
          <div>
            {t('%s is not right as a column name, please alias it ' +
            '(as in SELECT count(*) ', colName)} <strong>{t('AS my_alias')}</strong>) {t('using only ' +
            'alphanumeric characters and underscores')}
          </div>);
      }
    });
    this.setState({ hints });
  }
  mergedColumns() {
    const columns = Object.assign({}, this.state.columns);
    if (this.props.query && this.props.query.results.columns) {
      this.props.query.results.columns.forEach((col) => {
        if (columns[col.name] === undefined) {
          columns[col.name] = col;
        }
      });
    }
    return columns;
  }
  buildETLOptions() {
    return {
      etlName: this.state.etlName,
      chunkSize: this.state.chunkSize,
      columns: this.state.columns,
      sql: this.props.query.sql,
      dbId: this.props.query.dbId,
    };
  }
  buildETLAdvise() {
    let advise;
    const timeout = this.props.timeout;
    const queryDuration = moment.duration(this.props.query.endDttm - this.props.query.startDttm);
    if (Math.round(queryDuration.asMilliseconds()) > timeout * 1000) {
      advise = (
        <Alert bsStyle="warning">
          This query took {Math.round(queryDuration.asSeconds())} seconds to run,
          and the explore view times out at {timeout} seconds,
          following this flow will most likely lead to your query timing out.
          We recommend your summarize your data further before following that flow.
          If activated you can use the <strong>CREATE TABLE AS</strong> feature
          to store a summarized data set that you can then explore.
        </Alert>);
    }
    return advise;
  }
  CreateETL() {
    console.log(this.buildETLOptions());
    this.props.actions.createETLDatasource(this.buildETLOptions(), this)
      .done(() => {
        notify.info(t('Creating a ETL data source and popping a new tab'));
        window.open('/etltableview/list/');
      })
      .fail(() => {
        notify.error(this.props.errorMessage);
    });
  }
  changeETLName(event) {
    this.setState({ etlName: event.target.value }, this.validate);
  }
  changeChunkSize(event) {
    this.setState({ chunkSize: event.target.value }, this.validate);
  }
  changeCheckbox(attr, columnName, event) {
    let columns = this.mergedColumns();
    const column = Object.assign({}, columns[columnName], { [attr]: event.target.checked });
    columns = Object.assign({}, columns, { [columnName]: column });
    this.setState({ columns }, this.validate);
  }
  changeColumnTypeFunction(columnName, option) {
    let columns = this.mergedColumns();
    const val = (option) ? option.value : null;
    const column = Object.assign({}, columns[columnName], { type: val });
    columns = Object.assign({}, columns, { [columnName]: column });
    this.setState({ columns }, this.validate);
  }
  changeColumnVerboseNameFunction(columnName, event) {
    let columns = this.mergedColumns();
    const val = (event.target.value) ? event.target.value : null;
    const column = Object.assign({}, columns[columnName], { verbose_name: val });
    columns = Object.assign({}, columns, { [columnName]: column });
    this.setState({ columns }, this.validate);
  }
  render() {
    if (!(this.props.query) || !(this.props.query.results) || !(this.props.query.results.columns)) {
      return (
        <div className="ETLModal">
          <Modal show={this.props.show} onHide={this.props.onHide}>
            <Modal.Body>
              {t('No results available for this query')}
            </Modal.Body>
          </Modal>
        </div>
      );
    }
    const tableData = this.props.query.results.columns.map(col => ({
      column: col.name,
      verbose_name: (
        <input
          type="text"
          value={(this.state.columns[col.name].verbose_name) ? this.state.columns[col.name].verbose_name : col.name}
          style={{ width: '140px', height: '28px' }}
          onChange={this.changeColumnVerboseNameFunction.bind(this, col.name)}
          className="form-control"
        />
      ),
      is_index: (
        <input
          type="checkbox"
          onChange={this.changeCheckbox.bind(this, 'is_index', col.name)}
          checked={(this.state.columns[col.name].is_index) ? this.state.columns[col.name].is_index : false}
          className="form-control"
        />
      ),
      column_type: (
        <Select
          options={[
            { value: 'STRING', label: 'String' },
            { value: 'TEXT', label: 'Text' },
            { value: 'INTEGER', label: 'Integer' },
            { value: 'NUMERIC', label: 'Numeric' },
            { value: 'DATETIME', label: 'DateTime' },
            { value: 'DATE', label: 'Date' },
            { value: 'TIME', label: 'Time' },
            { value: 'BOOLEAN', label: 'Boolean' },
            { value: 'ARRAY', label: 'ARRAY' },
            { value: 'JSON', label: 'JSON' },
          ]}
          onChange={this.changeColumnTypeFunction.bind(this, col.name)}
          value={(this.state.columns[col.name] && this.state.columns[col.name].type) ? ((this.state.columns[col.name].type !== 'OBJECT') ? this.state.columns[col.name].type : 'TEXT') : 'TEXT'}
        />
      ),
    }));
    const alerts = this.state.hints.map((hint, i) => (
      <Alert bsStyle="warning" key={i}>{hint}</Alert>
    ));
    const modal = (
      <div className="ETLModal">
        <Modal show={this.props.show} onHide={this.props.onHide}>
          <Modal.Header closeButton>
            <Modal.Title>{t('Create ETL')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {alerts}
            {this.buildETLAdvise()}
            <div className="row">
              <Col md={6}>
                {t('ETL Name')} <sup>{t('_etl_{name}')}</sup>
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder={t('_etl_{name}')}
                  onChange={this.changeETLName.bind(this)}
                  value={this.state.etlName}
                />
              </Col>
              <Col md={6}>
                {t('Chunk Size')}
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder={t('1000')}
                  onChange={this.changeChunkSize.bind(this)}
                  value={this.state.chunkSize}
                />
              </Col>
            </div>
            <hr />
            <Table
              className="table table-condensed"
              columns={['column', 'verbose_name', 'is_index', 'column_type']}
              data={tableData}
            />
            <Button
              onClick={this.CreateETL.bind(this)}
              bsStyle="primary"
              disabled={(this.state.hints.length > 0)}
            >
              {t('Create ETL')}
            </Button>
          </Modal.Body>
        </Modal>
      </div>
    );
    return modal;
  }
}
ETLModal.propTypes = propTypes;
ETLModal.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasource: state.datasource,
    errorMessage: state.errorMessage,
    timeout: state.common ? state.common.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ETLModal };
export default connect(mapStateToProps, mapDispatchToProps)(ETLModal);
