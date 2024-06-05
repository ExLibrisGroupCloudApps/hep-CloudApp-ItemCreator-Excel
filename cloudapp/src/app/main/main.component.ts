import { from} from 'rxjs';
import { tap , mergeMap} from 'rxjs/operators';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RestErrorResponse } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import { ItemService } from './item.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  files: File[] = [];
  loading = false;
  arrayBuffer:any;
  processed = 0;
  resultMessage = '';
  private log = (str: string) => this.resultMessage += str+'\n';  
  

  constructor(
    private itemService: ItemService,
    private translate: TranslateService
  ) { }

  ngOnInit() {
  }

  ngOnDestroy(): void {
  }

  onSelect(event) {
    this.files.push(...event.addedFiles);
  }

  onRemove(event) {
    this.files.splice(this.files.indexOf(event), 1);
  } 
  
  loadExecl() {
    this.loading = true;
    this.processed = 0;
    let fileReader = new FileReader();
    let results =[];
    this.resultMessage = '';
    fileReader.onload = (e) => {
        this.arrayBuffer = fileReader.result;
        var data = new Uint8Array(this.arrayBuffer);
        var arr = new Array();
        for(var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        var workbook = XLSX.read(bstr, {type:"binary"});
        var first_sheet_name = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[first_sheet_name];
        
        let items: any[] =XLSX.utils.sheet_to_json(worksheet , {defval:""});
        from(items.map(item => 
          this.itemService
          .processCreateItem(item)
          .pipe(tap(() => this.processed++))
          )
        )
        .pipe(mergeMap(obs=>obs, 1))
        .subscribe({
          next: result => results.push(result),
          complete: () => {
            setTimeout(() => {
              let successCount = 0, errorCount = 0; 
              let updatedItems = new Array();
              let errorSummary = '';
              results.forEach(res => {
                if (isRestErrorResponse(res) || res instanceof Error) {
                  errorCount++;
                  errorSummary += `${this.translate.instant("Main.Error")}: ${res.message}` +'\n\n';
                } else {
                  successCount++;
                  updatedItems.push(res.item_data.barcode ? res.item_data.barcode : res.item_data.pid);
                }
              });
              this.log(`${this.translate.instant("Main.Processed")}: ${this.processed}`);
              this.log(`${this.translate.instant("Main.Created")}: ${successCount}`);
              this.log(`${this.translate.instant("Main.Failed")}: ${errorCount}`+'\n');
              if(errorSummary){
                this.log(`${errorSummary}`);
              }
              if(updatedItems.length > 0){
                this.log(`${this.translate.instant("Main.ProcessedItems")}: ${updatedItems.join(", ")}`);
              }
              this.loading = false;
              this.files= [];
            }, 500);
          }
        });
    }
    fileReader.readAsArrayBuffer(this.files[0]);
}
}
const isRestErrorResponse = (object: any): object is RestErrorResponse => 'error' in object;