import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TiposrolComponent } from './tiposrol.component';

describe('TiposrolComponent', () => {
  let component: TiposrolComponent;
  let fixture: ComponentFixture<TiposrolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiposrolComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TiposrolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
