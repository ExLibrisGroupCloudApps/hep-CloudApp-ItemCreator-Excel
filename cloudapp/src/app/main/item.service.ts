import { Injectable } from '@angular/core';
import { CloudAppRestService, HttpMethod, RestErrorResponse } from '@exlibris/exl-cloudapp-angular-lib';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ItemService {

  constructor(
    private restService: CloudAppRestService

  ) { }

  processCreateItem(item: any) {
    if(!(item.mms_id && item.holding_id)){
      return of(this.handleError({ok:false, status:"", message:"Keys mms_id and holding_id are needed", statusText:"", error:true}, item));
    }
    const mms_id = item.mms_id;
    const holding_id = item.holding_id
    let url= `/bibs/${mms_id}/holdings/${holding_id}/items`;
    const itemToSend = this.getItemToSend(item);
    console.log(itemToSend);
    return this.restService.call(url).pipe(
      switchMap(resp => {
        console.log(resp, item);
        if(resp.item == null && resp.total_record_count > 0) {
          return of(this.handleError({ok:false, status:"", message:`Mms ID ${mms_id} does not exist`, statusText:"", error:true}, item));
        }
        return this.restService.call({
        url,
        method: HttpMethod.POST,
        requestBody: itemToSend
      }).pipe(
        catchError(e => {
          if(e.message.includes("Check holdings")) {
            e.message = `Holding ID ${holding_id} does not exist`;
          }
          return of(this.handleError(e, item));
        })
      )}
    ));
  }
  
  public handleError(e: RestErrorResponse, item: any) {
    if (item) {
      e.message = e.message + `\n(${JSON.stringify(item)})`;
    }
    return e;
  }
  private getItemToSend(item: any) {
    delete item.mms_id;
    delete item.holding_id;
    for (const key in item) {
      if(key.includes("_EMPTY")) {
        delete item[key];
      }
    }
    const keysToSendIntoObject = ["physical_material_type", "policy", "provenance", "break_indicator", "pattern_type",
    "alternative_call_number_type", "physical_condition", "committed_to_retain", "retention_reason"];
    Object.keys(item).filter(key => keysToSendIntoObject.includes(key)).forEach(keyToChange => {
      const value = item[keyToChange];
      item[keyToChange] = {value: value};
    });
    return {item_data: item};
  }

  
}