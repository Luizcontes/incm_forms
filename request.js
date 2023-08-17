const { v4: uuid } = require('uuid');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const xml2js = require('xml2js');
const parseString = xml2js.parseString;
const builder = new xml2js.Builder();

const filename = process.argv.slice(2)[0];
const readData = "C:\\Users\\a907441\\Projects\\INCM\\sample\\" + filename + ".xml";
const output = "C:\\Users\\a907441\\Projects\\INCM\\output\\" + filename + "Output.xml";
const report = "C:\\Users\\a907441\\Projects\\INCM\\report\\report.xml";
const errors = "C:\\Users\\a907441\\Projects\\INCM\\report\\errors.xml";

const XMLData = fs.readFileSync(readData);
const date = new Date(Date.now());
const year = date.getFullYear();
const month = () => {
  let d = date.getMonth() + 1;
  if (d < 10) {
    return `0${d}`
  }
  return d
};
const hour = () => {
  let h = date.getHours() - 1;
  if (h < 10) {
    return `0${h}`
  }
  return h
};

const day = date.getDate();
const fullDate = `${year}-${month()}-${day}+01:00`;
const fullHour = `${hour()}:00:00+01:00`;

let xmlObj;
parseString(XMLData, (err, result) => {
  xmlObj = result;
});

xmlObj.PriorInformationNotice['cbc:ID'][0]._ = uuid();
xmlObj.PriorInformationNotice['cbc:IssueDate'][0] = fullDate;
xmlObj.PriorInformationNotice['cbc:IssueTime'][0] = fullHour;

let xml = builder.buildObject(xmlObj)
fs.writeFileSync(output, xml);

const form = new FormData();
form.append('metadata', '{"noticeAuthorEmail":"john@doe.com","noticeAuthorLocale": "pt"}');
form.append('notice', fs.createReadStream(output));

axios({
  method: 'post',
  url: 'https://enotices2.preview.ted.europa.eu/esenders/api/v2/notice/notices/submit',
  data: form,
  headers: {
    Authorization: "Bearer e0e31bf3087d4cbd936c72fe7f12af89"
  }
}).then(res => res.data)
  .then(data => {
    if (data.success === false) {
      axios({
        method: 'get',
        url: data.validationReportUrl,
        headers: {
          Authorization: "Bearer e0e31bf3087d4cbd936c72fe7f12af89"
        }
      })
        .then(res => {
          fs.writeFileSync(report, res.data)

          const XMLReport = res.data;
          parseString(XMLReport, (err, result) => {

            delete result['svrl:schematron-output']['svrl:active-pattern'];
            delete result['svrl:schematron-output']['svrl:fired-rule'];
            delete result['svrl:schematron-output']['svrl:ns-prefix-in-attribute-values'];
            delete result['svrl:schematron-output']['$'];

            console.log("Errors: " + result['svrl:schematron-output']['svrl:failed-assert'].length)
            Object.keys(result['svrl:schematron-output']['svrl:failed-assert']).forEach( (key, i) => {
              console.log("\nError " + (i + 1));
              console.log(result['svrl:schematron-output']['svrl:failed-assert'][key]['$'].test);
              console.log("---------------------------------\n");
            });
            let fail = builder.buildObject(result);
            fs.writeFileSync(errors, fail);
          });
        })
    } else {
      console.log("Congrats you rock!!!!");
    }
  })
  .catch(err => console.log(err.response.data));
